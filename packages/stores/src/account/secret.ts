import { AccountSetBase, AccountSetBaseSuper, MsgOpt } from "./base";
import { SecretQueries, QueriesSetBase, IQueriesStore } from "../query";
import { Buffer } from "buffer/";
import { CoinPrimitive } from "../common";
import { ChainGetter } from "../chain";
import { DenomHelper } from "@keplr-wallet/common";
import { MsgExecuteContract as MsgExecuteContractV1Beta1 } from "@keplr-wallet/proto-types/secret/compute/v1beta1/msg";
import { MsgExecuteContract as MsgExecuteContractV1 } from "@keplr-wallet/proto-types/secret/compute/v1/msg";
import { Bech32Address } from "@keplr-wallet/cosmos";
import { Dec, DecUtils } from "@keplr-wallet/unit";
import {
  AppCurrency,
  KeplrSignOptions,
  StdFee,
  SecretUtils,
} from "@keplr-wallet/types";
import { DeepPartial, DeepReadonly, Optional } from "utility-types";
import { CosmosAccount } from "./cosmos";
import deepmerge from "deepmerge";

export interface SecretAccount {
  secret: SecretAccountImpl;
}

export const SecretAccount = {
  use(options: {
    msgOptsCreator?: (
      chainId: string
    ) => DeepPartial<SecretMsgOpts> | undefined;
    queriesStore: IQueriesStore<SecretQueries>;
  }): (
    base: AccountSetBaseSuper & CosmosAccount,
    chainGetter: ChainGetter,
    chainId: string
  ) => SecretAccount {
    return (base, chainGetter, chainId) => {
      const msgOptsFromCreator = options.msgOptsCreator
        ? options.msgOptsCreator(chainId)
        : undefined;

      return {
        secret: new SecretAccountImpl(
          base,
          chainGetter,
          chainId,
          options.queriesStore,
          deepmerge<SecretMsgOpts, DeepPartial<SecretMsgOpts>>(
            defaultSecretMsgOpts,
            msgOptsFromCreator ? msgOptsFromCreator : {}
          )
        ),
      };
    };
  },
};

/**
 * @deprecated Predict gas through simulation rather than using a fixed gas.
 */
export interface SecretMsgOpts {
  readonly send: {
    readonly secret20: Pick<MsgOpt, "gas">;
  };

  readonly createSecret20ViewingKey: Pick<MsgOpt, "gas">;
  readonly executeSecretWasm: Pick<MsgOpt, "type">;
}

/**
 * @deprecated Predict gas through simulation rather than using a fixed gas.
 */
export const defaultSecretMsgOpts: SecretMsgOpts = {
  send: {
    secret20: {
      gas: 250000,
    },
  },

  createSecret20ViewingKey: {
    gas: 150000,
  },

  executeSecretWasm: {
    type: "wasm/MsgExecuteContract",
  },
};

export class SecretAccountImpl {
  constructor(
    protected readonly base: AccountSetBase & CosmosAccount,
    protected readonly chainGetter: ChainGetter,
    protected readonly chainId: string,
    protected readonly queriesStore: IQueriesStore<SecretQueries>,
    protected readonly _msgOpts: SecretMsgOpts
  ) {
    this.base.registerMakeSendTokenFn(this.processMakeSendTokenTx.bind(this));
  }

  /**
   * @deprecated Predict gas through simulation rather than using a fixed gas.
   */
  get msgOpts(): SecretMsgOpts {
    return this._msgOpts;
  }

  protected processMakeSendTokenTx(
    amount: string,
    currency: AppCurrency,
    recipient: string
  ) {
    const denomHelper = new DenomHelper(currency.coinMinimalDenom);

    if (denomHelper.type === "secret20") {
      const actualAmount = (() => {
        let dec = new Dec(amount);
        dec = dec.mul(DecUtils.getPrecisionDec(currency.coinDecimals));
        return dec.truncate().toString();
      })();

      if (!("type" in currency) || currency.type !== "secret20") {
        throw new Error("Currency is not secret20");
      }

      Bech32Address.validate(
        recipient,
        this.chainGetter.getChain(this.chainId).bech32Config
          ?.bech32PrefixAccAddr
      );

      return this.makeExecuteSecretContractTx(
        "send",
        currency.contractAddress,
        {
          transfer: {
            recipient: recipient,
            amount: actualAmount,
          },
        },
        [],
        (tx) => {
          if (tx.code == null || tx.code === 0) {
            // After succeeding to send token, refresh the balance.
            const queryBalance = this.queries.queryBalances
              .getQueryBech32Address(this.base.bech32Address)
              .balances.find((bal) => {
                return (
                  bal.currency.coinMinimalDenom === currency.coinMinimalDenom
                );
              });

            if (queryBalance) {
              queryBalance.fetch();
            }
          }
        }
      );
    }
  }

  async createSecret20ViewingKey(
    contractAddress: string,
    memo: string = "",
    stdFee: Partial<StdFee> = {},
    signOptions?: KeplrSignOptions,
    onFulfill?: (tx: any, viewingKey: string) => void
  ) {
    const random = new Uint8Array(32);
    crypto.getRandomValues(random);
    const key = Buffer.from(random).toString("hex");

    await this.makeExecuteSecretContractTx(
      "createSecret20ViewingKey",
      contractAddress,
      {
        set_viewing_key: { key },
      },
      []
    ).send(
      {
        amount: stdFee.amount ?? [],
        gas: stdFee.gas ?? this.msgOpts.createSecret20ViewingKey.gas.toString(),
      },
      memo,
      signOptions,
      (tx) => {
        let viewingKey = "";
        if (tx.code == null || tx.code === 0) {
          viewingKey = key;
        }

        if (onFulfill) {
          onFulfill(tx, viewingKey);
        }
      }
    );
    return;
  }

  makeExecuteSecretContractTx(
    // This arg can be used to override the type of sending tx if needed.
    type: keyof SecretMsgOpts | "unknown" = "executeSecretWasm",
    contractAddress: string,
    // eslint-disable-next-line @typescript-eslint/ban-types
    obj: object,
    sentFunds: CoinPrimitive[],
    preOnTxEvents?:
      | ((tx: any) => void)
      | {
          onBroadcasted?: (txHash: Uint8Array) => void;
          onFulfill?: (tx: any) => void;
        }
  ) {
    Bech32Address.validate(
      contractAddress,
      this.chainGetter.getChain(this.chainId).bech32Config?.bech32PrefixAccAddr
    );

    let encryptedMsg: Uint8Array;

    return this.base.cosmos.makeTx(
      type,
      async () => {
        const keplr = await this.base.getKeplr();
        if (!keplr) {
          throw new Error("Can't get the Keplr API");
        }

        const enigmaUtils = keplr.getEnigmaUtils(this.chainId);

        encryptedMsg = await this.encryptSecretContractMsg(
          contractAddress,
          obj,
          enigmaUtils
        );

        const msg = (await enigmaUtils.isNewApi())
          ? {
              type: this.msgOpts.executeSecretWasm.type,
              value: {
                sender_address: this.base.bech32Address,
                sender: Buffer.from(
                  Bech32Address.fromBech32(this.base.bech32Address).address
                ).toString("base64"),
                contract: Buffer.from(
                  Bech32Address.fromBech32(contractAddress).address
                ).toString("base64"),
                // callback_code_hash: "",
                msg: Buffer.from(encryptedMsg).toString("base64"),
                sent_funds: sentFunds,
                // callback_sig: null,
              },
            }
          : {
              type: this.msgOpts.executeSecretWasm.type,
              value: {
                sender: this.base.bech32Address,
                contract: contractAddress,
                // callback_code_hash: "",
                msg: Buffer.from(encryptedMsg).toString("base64"),
                sent_funds: sentFunds,
                // callback_sig: null,
              },
            };

        const protoMsg = (await enigmaUtils.isNewApi())
          ? {
              // type url must be with v1beta1
              typeUrl: "/secret.compute.v1beta1.MsgExecuteContract",
              value: MsgExecuteContractV1.encode(
                MsgExecuteContractV1.fromPartial({
                  sender: Buffer.from(msg.value.sender, "base64"),
                  senderAddress: msg.value.sender_address,
                  contract: Buffer.from(msg.value.contract, "base64"),
                  msg: Buffer.from(msg.value.msg, "base64"),
                  sentFunds: msg.value.sent_funds,
                })
              ).finish(),
            }
          : {
              typeUrl: "/secret.compute.v1beta1.MsgExecuteContract",
              value: MsgExecuteContractV1Beta1.encode(
                MsgExecuteContractV1Beta1.fromPartial({
                  sender: Bech32Address.fromBech32(msg.value.sender).address,
                  contract: Bech32Address.fromBech32(msg.value.contract)
                    .address,
                  msg: Buffer.from(msg.value.msg, "base64"),
                  sentFunds: msg.value.sent_funds,
                })
              ).finish(),
            };

        return {
          aminoMsgs: [msg],
          protoMsgs: [protoMsg],
        };
      },
      preOnTxEvents
    );
  }

  /**
   * @deprecated
   */
  async sendExecuteSecretContractMsg(
    // This arg can be used to override the type of sending tx if needed.
    type: keyof SecretMsgOpts | "unknown" = "executeSecretWasm",
    contractAddress: string,
    // eslint-disable-next-line @typescript-eslint/ban-types
    obj: object,
    sentFunds: CoinPrimitive[],
    memo: string = "",
    stdFee: Optional<StdFee, "amount">,
    signOptions?: KeplrSignOptions,
    onTxEvents?:
      | ((tx: any) => void)
      | {
          onBroadcasted?: (txHash: Uint8Array) => void;
          onFulfill?: (tx: any) => void;
        }
  ): Promise<Uint8Array> {
    let encryptedMsg: Uint8Array;

    await this.base.cosmos.sendMsgs(
      type,
      async () => {
        const keplr = await this.base.getKeplr();
        if (!keplr) {
          throw new Error("Can't get the Keplr API");
        }

        const enigmaUtils = keplr.getEnigmaUtils(this.chainId);

        encryptedMsg = await this.encryptSecretContractMsg(
          contractAddress,
          obj,
          enigmaUtils
        );

        const msg = (await enigmaUtils.isNewApi())
          ? {
              type: this.msgOpts.executeSecretWasm.type,
              value: {
                sender_address: this.base.bech32Address,
                sender: Buffer.from(
                  Bech32Address.fromBech32(this.base.bech32Address).address
                ).toString("base64"),
                contract: Buffer.from(
                  Bech32Address.fromBech32(contractAddress).address
                ).toString("base64"),
                // callback_code_hash: "",
                msg: Buffer.from(encryptedMsg).toString("base64"),
                sent_funds: sentFunds,
                // callback_sig: null,
              },
            }
          : {
              type: this.msgOpts.executeSecretWasm.type,
              value: {
                sender: this.base.bech32Address,
                contract: contractAddress,
                // callback_code_hash: "",
                msg: Buffer.from(encryptedMsg).toString("base64"),
                sent_funds: sentFunds,
                // callback_sig: null,
              },
            };

        const protoMsg = (await enigmaUtils.isNewApi())
          ? {
              // type url must be with v1beta1
              typeUrl: "/secret.compute.v1beta1.MsgExecuteContract",
              value: MsgExecuteContractV1.encode(
                MsgExecuteContractV1.fromPartial({
                  sender: Buffer.from(msg.value.sender, "base64"),
                  senderAddress: msg.value.sender_address,
                  contract: Buffer.from(msg.value.contract, "base64"),
                  msg: Buffer.from(msg.value.msg, "base64"),
                  sentFunds: msg.value.sent_funds,
                })
              ).finish(),
            }
          : {
              typeUrl: "/secret.compute.v1beta1.MsgExecuteContract",
              value: MsgExecuteContractV1Beta1.encode(
                MsgExecuteContractV1Beta1.fromPartial({
                  sender: Bech32Address.fromBech32(msg.value.sender).address,
                  contract: Bech32Address.fromBech32(msg.value.contract)
                    .address,
                  msg: Buffer.from(msg.value.msg, "base64"),
                  sentFunds: msg.value.sent_funds,
                })
              ).finish(),
            };

        return {
          aminoMsgs: [msg],
          protoMsgs: [protoMsg],
        };
      },
      memo,
      {
        amount: stdFee.amount ?? [],
        gas: stdFee.gas,
      },
      signOptions,
      onTxEvents
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return encryptedMsg!;
  }

  protected async encryptSecretContractMsg(
    contractAddress: string,
    // eslint-disable-next-line @typescript-eslint/ban-types
    obj: object,
    enigmaUtils: SecretUtils
  ): Promise<Uint8Array> {
    const queryContractCodeHashResponse =
      await this.queries.secret.querySecretContractCodeHash
        .getQueryContract(contractAddress)
        .waitResponse();

    if (!queryContractCodeHashResponse) {
      throw new Error(
        `Can't get the code hash of the contract (${contractAddress})`
      );
    }

    const contractCodeHash = queryContractCodeHashResponse.data.code_hash;

    return await enigmaUtils.encrypt(contractCodeHash, obj);
  }

  protected get queries(): DeepReadonly<QueriesSetBase & SecretQueries> {
    return this.queriesStore.get(this.chainId);
  }
}
