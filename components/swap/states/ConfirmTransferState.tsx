import React from "react";
import Image from "next/image";
import { AssetConfig, ChainInfo } from "@axelar-network/axelarjs-sdk";
import { useSwapStore } from "../../../store";
import { AddressShortener, InputWrapper } from "../../common";
import { AXELARSCAN_URL } from "../../../config/constants";
import { ProgressBar } from "./parts";
import { copyToClipboard } from "../../../utils";
import { useSwitchNetwork } from "wagmi";
import { getWagmiChains } from "../../../config/web3";
import { TransferStats } from "../parts";

const addTokenToMetamask = async (asset: AssetConfig, destChain: ChainInfo) => {
  try {
    const { tokenAddress: address, assetSymbol: symbol } =
      asset.chain_aliases[destChain.chainName.toLowerCase()];
    const { decimals } = asset;
    return await (window as any).ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address,
          symbol,
          decimals,
          image: "",
        },
      },
    });
  } catch (error) {
    console.log(error);
  }
};

export const ConfirmTransferState = () => {
  const { depositAddress, destAddress, txInfo, asset, destChain } =
    useSwapStore();
  const { chains, error, isLoading, pendingChainId, switchNetwork } =
    useSwitchNetwork({
      onSuccess(data) {
        console.log("Success", data);
        setTimeout(
          () => addTokenToMetamask(asset as AssetConfig, destChain),
          2000
        );
      },
    });

  function renderTxConfirmationInfo() {
    return (
      <div className="flex flex-col justify-center h-full text-base text-md gap-y-1">
        <h2 className="text-lg font-bold text-center">Transfer complete!</h2>
        <div className="my-2 divider" />
        <div>
          <a
            className="flex items-center text-primary hover:underline gap-x-2"
            href={`${AXELARSCAN_URL}/transfer/${txInfo.sourceTxHash}`}
            target="_blank"
            rel="noreferrer"
          >
            <span>Visit Axelarscan for more information</span>
            <Image src={"/assets/ui/link.svg"} height={16} width={16} />
          </a>
        </div>
        {destChain.module === "evm" && (
          <div
            className="flex items-center justify-center hover:underline hover:cursor-pointer gap-x-2"
            onClick={() => {
              switchNetwork?.(
                getWagmiChains().find(
                  (chain) =>
                    chain.networkNameOverride ===
                    destChain.chainName.toLowerCase()
                )?.id
              );
            }}
          >
            <span>Add token to Metamask</span>
            <Image
              src={"/assets/wallets/metamask.logo.svg"}
              height={16}
              width={16}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <TransferStats />
      <InputWrapper className="h-auto">
        <div className="h-full space-x-2">
          <div className="flex flex-col w-full h-full">
            <div className="relative flex flex-col h-full">
              <ProgressBar level={3} />
              <div className="flex items-center justify-center h-full py-4 mt-auto text-xs gap-x-2">
                {renderTxConfirmationInfo()}
              </div>
            </div>
          </div>
        </div>
      </InputWrapper>
    </>
  );
};
