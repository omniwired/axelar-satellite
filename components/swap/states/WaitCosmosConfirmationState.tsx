import React from "react";
import { SpinnerRoundFilled } from "spinners-react";
import { useDetectDestTransferConfirmation } from "../../../hooks";
import { InputWrapper } from "../../common";
import { TransferStats } from "../parts";
import { ProgressBar } from "./parts";

export const WaitCosmosConfirmationState = () => {
  useDetectDestTransferConfirmation();

  function renderConfirmations() {
    return (
      <>
        <SpinnerRoundFilled size={20} thickness={147} color={"#00a5ff"} />
        <span className="font-semibold">Waiting for confirmations...</span>
      </>
    );
  }

  return (
    <>
      <TransferStats />
      <InputWrapper className="h-40">
        <div className="h-full space-x-2">
          <div className="flex flex-col w-full h-full">
            <div className="h-full">
              <ProgressBar level={2} />

              <div className="flex items-center justify-center mt-6 text-xs gap-x-2">
                {renderConfirmations()}
              </div>
            </div>
          </div>
        </div>
      </InputWrapper>
    </>
  );
};
