import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  AssetConfig,
  AssetInfo,
  CosmosChain,
} from "@axelar-network/axelarjs-sdk";
import { BigNumber } from "bignumber.js";
import {
  SigningStargateClient,
  StargateClient,
  StdFee,
} from "@cosmjs/stargate";
import { OfflineSigner } from "@cosmjs/launchpad";
import { ENVIRONMENT } from "../../../../config/constants";
import { useSwapStore, useWalletStore } from "../../../../store";
import {
  useDetectDepositConfirmation,
  useGetKeplerWallet,
  useHasKeplerWallet,
} from "../../../../hooks";
import { curateCosmosChainId } from "../../../../utils";
import { getCosmosChains } from "../../../../config/web3";
import { utils } from "ethers";
import toast from "react-hot-toast";
import Long from "long";
import { Height } from "cosmjs-types/ibc/core/client/v1/client";
import { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";
import { SwapStatus } from "../../../../utils/enums";
import { SpinnerRoundOutlined } from "spinners-react";
import { renderGasFee } from "../../../../utils/renderGasFee";

export const CosmosWalletTransfer = () => {
  const allAssets = useSwapStore((state) => state.allAssets);
  const [currentAsset, setCurrentAsset] = useState<AssetInfo>();
  const [tokenAddress, setTokenAddress] = useState<string>("");

  // used to hide wallets when transaction has been triggered
  const [isTxOngoing, setIsTxOngoing] = useState(false);

  const {
    srcChain,
    destChain,
    asset,
    tokensToTransfer,
    depositAddress,
    setSwapStatus,
    setTxInfo,
  } = useSwapStore((state) => state);
  const { setKeplrConnected, keplrConnected } = useWalletStore(
    (state) => state
  );
  const keplerWallet = useGetKeplerWallet();
  const hasKeplerWallet = useHasKeplerWallet();

  useDetectDepositConfirmation();

  useEffect(() => {
    const assetCommonKey = asset?.common_key[ENVIRONMENT];
    const assetData = srcChain.assets?.find(
      (asset) => asset.common_key === assetCommonKey
    );

    setCurrentAsset(assetData);
    setTokenAddress(assetData?.tokenAddress as string);
  }, [asset]);

  function checkMinAmount(amount: string, minAmount?: number) {
    const minDeposit =
      renderGasFee(srcChain, destChain, asset as AssetConfig) || 0;
    console.log("min Deposit", minDeposit);
    if (new BigNumber(amount || "0") <= new BigNumber(minDeposit))
      return { minDeposit, minAmountOk: false };
    return {
      minDeposit,
      minAmountOk: true,
    };
  }

  async function handleOnKeplrConnect() {
    const { keplr } = window;
    const chain = getCosmosChains(allAssets).find(
      (chain) => chain.chainIdentifier === "axelar"
    );
    if (!chain) return;
    try {
      await keplr?.enable(chain.chainId);
    } catch (e) {
      console.log(
        "unable to connect to wallet natively, so trying experimental chain",
        e,
        chain.chainId
      );
      try {
        await keplr?.experimentalSuggestChain(chain);
        await keplr?.enable(chain.chainId);
      } catch (e2: any) {
        console.log("and yet there is a problem in trying to do that too", e2);
      }
    }
    const _signer = (await keplr?.getOfflineSignerAuto(
      chain.chainId
    )) as OfflineSigner;
    const [account] = await _signer.getAccounts();
    if (keplrConnected) toast.error("Wallet already connected");
    setKeplrConnected(true);
    return true;
  }

  async function handleOnTokensTransfer() {
    // if (!hasKeplerWallet) {
    //   const connectionResult = await handleOnKeplrConnect();
    //   if (!connectionResult) return;
    // }

    const cosmosChains = getCosmosChains(allAssets);
    const chainIdentifier = srcChain.chainName.toLowerCase();
    const cosmosChain = cosmosChains.find(
      (chain) => chain.chainIdentifier === chainIdentifier
    );
    if (!cosmosChain?.chainId) return toast.error("Chain id not found");

    const chainId = curateCosmosChainId(cosmosChain.chainId);

    const chain = getCosmosChains(allAssets).find(
      (_chain) => _chain.chainId === chainId
    );
    if (!chain) return;
    await keplerWallet?.experimentalSuggestChain(chain);
    await keplerWallet?.enable(chainId as string);

    const offlineSigner = (await keplerWallet?.getOfflineSignerAuto(
      chainId as string
    )) as OfflineSigner;
    const [account1] = await offlineSigner.getAccounts();
    const sourceAddress = account1.address;
    const cosmjs = await SigningStargateClient.connectWithSigner(
      chain.rpc,
      offlineSigner
    );

    const { minAmountOk, minDeposit } = checkMinAmount(
      tokensToTransfer,
      currentAsset?.minDepositAmt
    );

    console.log({
      minAmountOk,
      minDeposit,
    });

    if (!minAmountOk)
      return toast.error(
        `Token amount to transfer should be bigger than ${minDeposit}`
      );

    const sendCoin = {
      denom: currentAsset?.ibcDenom as string,
      amount: utils
        .parseUnits(tokensToTransfer, currentAsset?.decimals)
        .toString(),
    };
    const fee: StdFee = {
      gas: "150000",
      amount: [{ denom: "uaxl", amount: "30000" }],
    };

    // const key = await keplerWallet?.getKey(chainId as string);

    // const result = await cosmjs.sendTokens(
    //   key?.bech32Address as string,
    //   depositAddress,
    //   [sendCoin],
    //   fee
    // );
    const [_action, _channel, _denom] = currentAsset?.fullDenomPath?.split(
      "/"
    ) as string[];

    const timeoutHeight: Height = {
        revisionHeight: Long.fromNumber(10),
        revisionNumber: Long.fromNumber(10),
      },
      timeoutTimestamp = 0;

    const result = await cosmjs
      .sendIbcTokens(
        sourceAddress,
        depositAddress,
        Coin.fromPartial({
          ...sendCoin,
        }),
        _action,
        _channel,
        timeoutHeight,
        timeoutTimestamp,
        fee
      )
      .then((e) => {
        console.log("CosmosWalletTransfer");
        setTxInfo({
          sourceTxHash: e.transactionHash,
        });

        setIsTxOngoing(true);
        // setSwapStatus(SwapStatus.WAIT_FOR_CONFIRMATION);
      })
      .catch((error) => console.log(error));

    // let result
    // try {
    //   result = await cosmjs.sendTokens(
    //     senderAddress,
    //     depositAddress,
    //     [sendCoin],
    //     fee
    //   )
    // } catch (error: any) {
    //   throw new Error(error)
    // }
  }

  return (
    <div>
      <div className="flex justify-center my-2 gap-x-5">
        {isTxOngoing ? (
          <div className="flex items-center gap-x-2">
            <SpinnerRoundOutlined
              className="text-blue-500"
              size={20}
              color="#00a6ff"
            />
            <span className="text-sm">
              Waiting for transaction confirmation...
            </span>
          </div>
        ) : (
          <button onClick={handleOnTokensTransfer}>
            <Image
              src="/assets/wallets/kepler.logo.svg"
              height={25}
              width={25}
            />
          </button>
        )}
      </div>
    </div>
  );
};
