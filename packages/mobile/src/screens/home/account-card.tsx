import React, { FunctionComponent } from "react";
import { observer } from "mobx-react-lite";
import { Card, CardBody } from "../../components/card";
import { Image, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useStore } from "../../stores";
import { useStyle } from "../../styles";
import { AddressCopyable } from "../../components/address-copyable";
import { DoubleDoughnutChart } from "../../components/svg";
import { Button } from "../../components/button";
import { LoadingSpinner } from "../../components/spinner";
import { StakedTokenSymbol, TokenSymbol } from "../../components/token-symbol";
import { useSmartNavigation } from "../../navigation";
import { NetworkErrorView } from "./network-error-view";
import { Dec } from "@keplr-wallet/unit";
import { LedgerNotSupportedModal } from "./ledger-not-supported-modal";
import { KeplrError } from "@keplr-wallet/router";
import { LedgerSupportedModal } from "./leger-supported-modal";
import { ICNSInfo } from "../../config";

export const AccountCard: FunctionComponent<{
  containerStyle?: ViewStyle;
}> = observer(({ containerStyle }) => {
  const { chainStore, accountStore, queriesStore, priceStore } = useStore();

  const style = useStyle();

  const smartNavigation = useSmartNavigation();

  const account = accountStore.getAccount(chainStore.current.chainId);
  const queries = queriesStore.get(chainStore.current.chainId);
  const icnsQueries = queriesStore.get(ICNSInfo.chainId);
  const icnsQuery = icnsQueries.icns.queryICNSNames.getQueryContract(
    ICNSInfo.resolverContractAddress,
    accountStore.getAccount(chainStore.current.chainId).bech32Address
  );

  const shouldHideStakeCurrency =
    chainStore.current.chainId.startsWith("neutron") ||
    chainStore.current.stakeCurrency.coinMinimalDenom === "ustake";

  const queryStakable = queries.queryBalances.getQueryBech32Address(
    account.bech32Address
  ).stakable;
  const stakable = queryStakable.balance;

  const queryDelegated = queries.cosmos.queryDelegations.getQueryBech32Address(
    account.bech32Address
  );
  const delegated = queryDelegated.total;

  const queryUnbonding = queries.cosmos.queryUnbondingDelegations.getQueryBech32Address(
    account.bech32Address
  );
  const unbonding = queryUnbonding.total;

  const stakedSum = delegated.add(unbonding);

  const total = stakable.add(stakedSum);

  const totalPrice = priceStore.calculatePrice(total);

  // In the `Double Doughnut Chart` component, if data is undefined, nothing is displayed.
  // And,  if the data is [0, 0], a gray ring is displayed behind it.
  // However, data should be [0, 0] initially because no data is loaded at first.
  // But as a design decision, we should start with no gray ring behind it.
  // Therefore, in order not to display the gray ring behind it initially (from unloaded data),
  // when the balance response is not loaded, it is treated as undefined.
  const data: [number, number] | undefined = queryStakable.response
    ? [
        parseFloat(stakable.toDec().toString()),
        parseFloat(stakedSum.toDec().toString()),
      ]
    : undefined;

  return (
    <Card style={containerStyle}>
      <LedgerNotSupportedModal
        isOpen={(() => {
          if (
            account.rejectionReason &&
            account.rejectionReason instanceof KeplrError
          ) {
            if (
              account.rejectionReason.module === "keyring" &&
              account.rejectionReason.code === 152
            ) {
              return true;
            }
          }

          return false;
        })()}
        close={() => {
          // Prevent closing with gesture
        }}
      />
      <LedgerSupportedModal
        isOpen={(() => {
          if (
            account.rejectionReason &&
            account.rejectionReason instanceof KeplrError
          ) {
            if (
              account.rejectionReason.module === "keyring" &&
              account.rejectionReason.code === 901
            ) {
              return true;
            }
          }

          return false;
        })()}
        close={() => {
          // Prevent closing with gesture
        }}
      />
      <CardBody style={style.flatten(["padding-bottom-0"])}>
        <View style={style.flatten(["flex", "items-center"])}>
          <View
            style={style.flatten([
              "flex",
              "flex-row",
              "items-center",
              "margin-bottom-8",
            ])}
          >
            <Text style={style.flatten(["h4", "color-text-high"])}>
              {icnsQuery.primaryName
                ? icnsQuery.primaryName
                : account.name || "..."}
            </Text>

            {icnsQuery.primaryName ? (
              <View
                style={style.flatten(["height-1", "flex", "justify-center"])}
              >
                <Image
                  source={require("../../assets/image/icns-mark.png")}
                  style={style.flatten([
                    "width-20",
                    "height-20",
                    "margin-left-4",
                  ])}
                  resizeMode="contain"
                  fadeDuration={0}
                />
              </View>
            ) : null}
          </View>

          <AddressCopyable address={account.bech32Address} maxCharacters={22} />
          <View style={style.flatten(["margin-top-28", "margin-bottom-16"])}>
            <DoubleDoughnutChart data={data} />
            <View
              style={style.flatten([
                "absolute-fill",
                "items-center",
                "justify-center",
              ])}
            >
              <Text
                style={style.flatten([
                  "subtitle2",
                  "color-text-middle",
                  "margin-bottom-4",
                ])}
              >
                Total Balance
              </Text>
              <Text style={style.flatten(["h3", "color-text-high"])}>
                {(() => {
                  if (shouldHideStakeCurrency) {
                    const cur = chainStore.current.currencies[0];
                    const balance = queries.queryBalances
                      .getQueryBech32Address(account.bech32Address)
                      .getBalanceFromCurrency(cur);

                    const price = priceStore.calculatePrice(balance);
                    if (price) {
                      return price.toString();
                    }

                    return balance.shrink(true).maxDecimals(6).toString();
                  }

                  return totalPrice
                    ? totalPrice.toString()
                    : total.shrink(true).maxDecimals(6).toString();
                })()}
              </Text>
              {queryStakable.isFetching ? (
                <View
                  style={StyleSheet.flatten([
                    style.flatten(["absolute"]),
                    {
                      bottom: 33,
                    },
                  ])}
                >
                  <LoadingSpinner
                    color={style.get("color-loading-spinner").color}
                    size={22}
                  />
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </CardBody>
      <NetworkErrorView />
      <CardBody style={style.flatten(["padding-top-16"])}>
        <View style={style.flatten(["flex", "items-center"])}>
          <View
            style={style.flatten(
              ["flex-row", "items-center", "margin-bottom-28"],
              [shouldHideStakeCurrency && "margin-bottom-0"]
            )}
          >
            <TokenSymbol
              size={44}
              chainInfo={chainStore.current}
              currency={chainStore.current.stakeCurrency}
            />
            <View style={style.flatten(["margin-left-12"])}>
              <Text
                style={style.flatten([
                  "subtitle3",
                  "color-blue-400",
                  "dark:color-platinum-200",
                  "margin-bottom-4",
                ])}
              >
                Available
              </Text>
              <Text style={style.flatten(["h5", "color-text-high"])}>
                {(() => {
                  if (shouldHideStakeCurrency) {
                    const cur = chainStore.current.currencies[0];
                    return queries.queryBalances
                      .getQueryBech32Address(account.bech32Address)
                      .getBalanceFromCurrency(cur)
                      .maxDecimals(6)
                      .trim(true)
                      .shrink(true)
                      .toString();
                  }

                  return stakable
                    .maxDecimals(6)
                    .trim(true)
                    .shrink(true)
                    .toString();
                })()}
              </Text>
            </View>
            <View style={style.flatten(["flex-1"])} />
            <Button
              text="Send"
              size="small"
              containerStyle={style.flatten(["min-width-72"])}
              disabled={stakable.toDec().lte(new Dec(0))}
              onPress={() => {
                if (shouldHideStakeCurrency) {
                  const cur = chainStore.current.currencies[0];
                  smartNavigation.navigateSmart("Send", {
                    currency: cur.coinMinimalDenom,
                  });
                  return;
                }

                smartNavigation.navigateSmart("Send", {
                  currency: chainStore.current.stakeCurrency.coinMinimalDenom,
                });
              }}
            />
          </View>
          {!shouldHideStakeCurrency ? (
            <View
              style={style.flatten([
                "flex-row",
                "items-center",
                "margin-bottom-8",
              ])}
            >
              <StakedTokenSymbol size={44} />
              <View style={style.flatten(["margin-left-12"])}>
                <Text
                  style={style.flatten([
                    "subtitle3",
                    "color-blue-400",
                    "dark:color-platinum-200",
                    "margin-bottom-4",
                  ])}
                >
                  Staking
                </Text>
                <Text style={style.flatten(["h5", "color-text-high"])}>
                  {stakedSum.maxDecimals(6).trim(true).shrink(true).toString()}
                </Text>
              </View>
              <View style={style.flatten(["flex-1"])} />
              <Button
                text="Stake"
                mode="light"
                size="small"
                containerStyle={style.flatten(["min-width-72"])}
                disabled={stakable.toDec().lte(new Dec(0))}
                onPress={() => {
                  smartNavigation.navigateSmart("Validator.List", {});
                }}
              />
            </View>
          ) : null}
        </View>
      </CardBody>
    </Card>
  );
});
