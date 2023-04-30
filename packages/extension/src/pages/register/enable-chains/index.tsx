import React, { FunctionComponent, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores";
import { RegisterSceneBox } from "../components/register-scene-box";
import { Stack } from "../../../components/stack";
import { useRegisterHeader } from "../components/header";
import {
  useSceneEvents,
  useSceneTransition,
} from "../../../components/transition";
import { ChainInfo } from "@keplr-wallet/types";
import { CoinPretty } from "@keplr-wallet/unit";
import { Box } from "../../../components/box";
import { Column, Columns } from "../../../components/column";
import { XAxis, YAxis } from "../../../components/axis";
import { Gutter } from "../../../components/gutter";
import { TextInput } from "../../../components/input";
import { Subtitle3 } from "../../../components/typography";
import { Button } from "../../../components/button";
import { ColorPalette } from "../../../styles";
import { useEffectOnce } from "../../../hooks/use-effect-once";
import { useNavigate } from "react-router";
import { ChainImageFallback } from "../../../components/image";
import { Checkbox } from "../../../components/checkbox";

export const EnableChainsScene: FunctionComponent<{
  vaultId: string;
  candidateAddresses: {
    chainId: string;
    bech32Addresses: {
      coinType: number;
      address: string;
    }[];
  }[];
  isFresh: boolean;
}> = observer(({ vaultId, candidateAddresses, isFresh }) => {
  const { chainStore, accountStore, queriesStore, keyRingStore } = useStore();

  const navigate = useNavigate();

  const header = useRegisterHeader();
  useSceneEvents({
    onWillVisible: () => {
      header.setHeader({
        mode: "step",
        title: "Select Chains",
        paragraphs: ["Don’t worry, you can change your selections anytime."],
        stepCurrent: 3,
        stepTotal: 6,
      });
    },
  });

  // Handle coin type selection.
  useEffectOnce(() => {
    if (!isFresh) {
      for (const candidateAddress of candidateAddresses) {
        const queries = queriesStore.get(candidateAddress.chainId);
        const chainInfo = chainStore.getChain(candidateAddress.chainId);

        if (
          candidateAddress.bech32Addresses.length >= 2 &&
          keyRingStore.needMnemonicKeyCoinTypeFinalize(vaultId, chainInfo)
        ) {
          (async () => {
            const promises: Promise<unknown>[] = [];

            for (const bech32Address of candidateAddress.bech32Addresses) {
              const queryAccount =
                queries.cosmos.queryAccount.getQueryBech32Address(
                  bech32Address.address
                );

              promises.push(queryAccount.waitResponse());
            }

            await Promise.allSettled(promises);

            const mainAddress = candidateAddress.bech32Addresses.find(
              (a) => a.coinType === chainInfo.bip44.coinType
            );
            const otherAddresses = candidateAddress.bech32Addresses.filter(
              (a) => a.coinType !== chainInfo.bip44.coinType
            );

            let otherIsSelectable = false;
            if (mainAddress && otherAddresses.length > 0) {
              for (const otherAddress of otherAddresses) {
                const bech32Address = otherAddress.address;
                const queryAccount =
                  queries.cosmos.queryAccount.getQueryBech32Address(
                    bech32Address
                  );

                // Check that the account exist on chain.
                // With stargate implementation, querying account fails with 404 status if account not exists.
                // But, if account receives some native tokens, the account would be created and it may deserve to be chosen.
                if (queryAccount.response?.data && queryAccount.error == null) {
                  otherIsSelectable = true;
                  break;
                }
              }
            }

            if (!otherIsSelectable && mainAddress) {
              console.log(
                "Finalize mnemonic key coin type",
                vaultId,
                chainInfo.chainId,
                mainAddress.coinType
              );
              keyRingStore.finalizeMnemonicKeyCoinType(
                vaultId,
                chainInfo.chainId,
                mainAddress.coinType
              );
            }
          })();
        }
      }
    }
  });

  const sceneTransition = useSceneTransition();

  const [enabledChainIdentifiers, setEnabledChainIdentifiers] = useState(() => {
    // We assume that the chain store can be already initialized.
    // See FinalizeKeyScene
    // However, if the chain store is not initialized, we should handle these case too.
    const enabledChainIdentifiers: string[] =
      chainStore.enabledChainIdentifiers;

    for (const candidateAddress of candidateAddresses) {
      const queries = queriesStore.get(candidateAddress.chainId);
      const chainInfo = chainStore.getChain(candidateAddress.chainId);

      // If the chain is already enabled, skip.
      if (chainStore.isEnabledChain(candidateAddress.chainId)) {
        continue;
      }

      // If the chain is not enabled, check that the account exists.
      // If the account exists, turn on the chain.
      for (const bech32Address of candidateAddress.bech32Addresses) {
        // Check that the account has some assets or delegations.
        // If so, enable it by default
        const queryBalance = queries.queryBalances.getQueryBech32Address(
          bech32Address.address
        ).stakable;

        if (queryBalance.response?.data) {
          // A bit tricky. The stake coin is currently only native, and in this case,
          // we can check whether the asset exists or not by checking the response.
          const data = queryBalance.response.data as any;
          if (
            data.balances &&
            Array.isArray(data.balances) &&
            data.balances.length > 0
          ) {
            enabledChainIdentifiers.push(chainInfo.chainIdentifier);
            break;
          }
        }

        const queryDelegations =
          queries.cosmos.queryDelegations.getQueryBech32Address(
            bech32Address.address
          );
        if (queryDelegations.delegationBalances.length > 0) {
          enabledChainIdentifiers.push(chainInfo.chainIdentifier);
          break;
        }
      }
    }

    return enabledChainIdentifiers;
  });

  const enabledChainIdentifierMap = useMemo(() => {
    const map = new Map<string, boolean>();

    for (const enabledChainIdentifier of enabledChainIdentifiers) {
      map.set(enabledChainIdentifier, true);
    }

    return map;
  }, [enabledChainIdentifiers]);

  const [search, setSearch] = useState<string>("");

  const chainInfos = useMemo(() => {
    const trimSearch = search.trim();

    if (!trimSearch) {
      return chainStore.chainInfos;
    } else {
      return chainStore.chainInfos.filter((chainInfo) => {
        return (
          chainInfo.chainName
            .toLowerCase()
            .includes(trimSearch.toLowerCase()) ||
          chainInfo.stakeCurrency.coinDenom
            .toLowerCase()
            .includes(trimSearch.toLowerCase())
        );
      });
    }
  }, [chainStore.chainInfos, search]);

  return (
    <RegisterSceneBox>
      <TextInput
        placeholder="Search networks"
        value={search}
        onChange={(e) => {
          e.preventDefault();

          setSearch(e.target.value);
        }}
      />
      <Gutter size="0.75rem" />
      <Subtitle3
        style={{
          textAlign: "center",
        }}
      >
        {enabledChainIdentifiers.length} chain(s) selected
      </Subtitle3>
      <Gutter size="0.75rem" />
      <Box
        height="25.5rem"
        style={{
          overflowY: "scroll",
        }}
      >
        <Stack gutter="0.5rem">
          {chainInfos.map((chainInfo) => {
            const account = accountStore.getAccount(chainInfo.chainId);
            if (!account.bech32Address) {
              return null;
            }

            const queries = queriesStore.get(chainInfo.chainId);

            const balance = queries.queryBalances.getQueryBech32Address(
              account.bech32Address
            ).stakable.balance;

            const enabled =
              enabledChainIdentifierMap.get(chainInfo.chainIdentifier) || false;

            // At least, one chain should be enabled.
            const blockInteraction =
              enabledChainIdentifiers.length <= 1 && enabled;

            return (
              <ChainItem
                key={chainInfo.chainId}
                chainInfo={chainInfo}
                balance={balance}
                enabled={enabled}
                blockInteraction={blockInteraction}
                isFresh={isFresh}
                onClick={() => {
                  if (
                    enabledChainIdentifierMap.get(chainInfo.chainIdentifier)
                  ) {
                    setEnabledChainIdentifiers(
                      enabledChainIdentifiers.filter(
                        (chainIdentifier) =>
                          chainIdentifier !== chainInfo.chainIdentifier
                      )
                    );
                  } else {
                    setEnabledChainIdentifiers([
                      ...enabledChainIdentifiers,
                      chainInfo.chainIdentifier,
                    ]);
                  }
                }}
              />
            );
          })}
        </Stack>
      </Box>

      <Gutter size="1.25rem" />
      <Box width="22.5rem" marginX="auto">
        <Button
          text="Save"
          size="large"
          onClick={async () => {
            const enables: string[] = [];
            const disables: string[] = [];

            for (const chainInfo of chainStore.chainInfos) {
              const enabled =
                enabledChainIdentifierMap.get(chainInfo.chainIdentifier) ||
                false;

              if (enabled) {
                enables.push(chainInfo.chainIdentifier);
              } else {
                disables.push(chainInfo.chainIdentifier);
              }
            }

            const needFinalizeCoinType: string[] = [];
            for (const enable of enables) {
              const chainInfo = chainStore.getChain(enable);
              if (
                keyRingStore.needMnemonicKeyCoinTypeFinalize(vaultId, chainInfo)
              ) {
                // Remove enable from enables
                enables.splice(enables.indexOf(enable), 1);
                // And push it disables
                disables.push(enable);

                needFinalizeCoinType.push(enable);
              }
            }

            await Promise.all([
              (async () => {
                if (enables.length > 0) {
                  await chainStore.enableChainInfoInUIWithVaultId(
                    vaultId,
                    ...enables
                  );
                }
              })(),
              (async () => {
                if (disables.length > 0) {
                  await chainStore.disableChainInfoInUIWithVaultId(
                    vaultId,
                    ...disables
                  );
                }
              })(),
            ]);

            if (needFinalizeCoinType.length > 0) {
              sceneTransition.replace("select-derivation-path", {
                vaultId,
                chainIds: needFinalizeCoinType,

                totalCount: needFinalizeCoinType.length,
              });
            } else {
              navigate("/welcome", {
                replace: true,
              });
            }
          }}
        />
      </Box>
    </RegisterSceneBox>
  );
});

const ChainItem: FunctionComponent<{
  chainInfo: ChainInfo;
  balance: CoinPretty;

  enabled: boolean;
  blockInteraction: boolean;

  onClick: () => void;

  isFresh: boolean;
}> = observer(
  ({ chainInfo, balance, enabled, blockInteraction, onClick, isFresh }) => {
    const { priceStore } = useStore();

    const price = priceStore.calculatePrice(balance);

    return (
      <Box
        borderRadius="0.375rem"
        paddingX="1rem"
        paddingY="0.75rem"
        backgroundColor={
          // TODO: Add alpha if needed.
          enabled ? ColorPalette["gray-500"] : ColorPalette["gray-600"]
        }
        cursor={blockInteraction ? "not-allowed" : "pointer"}
        onClick={() => {
          if (!blockInteraction) {
            onClick();
          }
        }}
      >
        <Columns sum={1}>
          <XAxis alignY="center">
            <ChainImageFallback
              style={{
                width: "3rem",
                height: "3rem",
              }}
              src={chainInfo.chainSymbolImageUrl}
              alt={chainInfo.chainId}
            />

            <Gutter size="0.5rem" />

            <YAxis>
              <div>{chainInfo.chainName}</div>
              <Gutter size="0.25rem" />
              <div>{balance.currency.coinDenom}</div>
            </YAxis>
          </XAxis>
          <Column weight={1} />
          <XAxis alignY="center">
            {isFresh ? null : (
              <YAxis alignX="right">
                <div>
                  {balance
                    .maxDecimals(6)
                    .shrink(true)
                    .hideDenom(true)
                    .toString()}
                </div>
                <Gutter size="0.25rem" />
                <div>{price ? price.toString() : "-"}</div>
              </YAxis>
            )}

            <Gutter size="1rem" />
            <Checkbox
              checked={enabled}
              onChange={() => {
                if (!blockInteraction) {
                  onClick();
                }
              }}
            />
          </XAxis>
        </Columns>
      </Box>
    );
  }
);
