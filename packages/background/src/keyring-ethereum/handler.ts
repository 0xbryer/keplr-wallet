import {
  Env,
  Handler,
  InternalHandler,
  KeplrError,
  Message,
} from "@keplr-wallet/router";
import { RequestSignEthereumMsg, RequestJsonRpcToEvmMsg } from "./messages";
import { KeyRingEthereumService } from "./service";
import { PermissionInteractiveService } from "../permission-interactive";

export const getHandler: (
  service: KeyRingEthereumService,
  permissionInteractionService: PermissionInteractiveService
) => Handler = (
  service: KeyRingEthereumService,
  permissionInteractionService
) => {
  return (env: Env, msg: Message<unknown>) => {
    switch (msg.constructor) {
      case RequestSignEthereumMsg:
        return handleRequestSignEthereumMsg(
          service,
          permissionInteractionService
        )(env, msg as RequestSignEthereumMsg);
      case RequestJsonRpcToEvmMsg:
        return handleRequestJsonRpcToEvmMsg(
          service,
          permissionInteractionService
        )(env, msg as RequestJsonRpcToEvmMsg);
      default:
        throw new KeplrError("keyring", 221, "Unknown msg type");
    }
  };
};

const handleRequestSignEthereumMsg: (
  service: KeyRingEthereumService,
  permissionInteractionService: PermissionInteractiveService
) => InternalHandler<RequestSignEthereumMsg> = (
  service,
  permissionInteractionService
) => {
  return async (env, msg) => {
    await permissionInteractionService.ensureEnabled(
      env,
      [msg.chainId],
      msg.origin
    );

    return await service.signEthereumSelected(
      env,
      msg.origin,
      msg.chainId,
      msg.signer,
      msg.message,
      msg.signType
    );
  };
};

const handleRequestJsonRpcToEvmMsg: (
  service: KeyRingEthereumService,
  permissionInteractionService: PermissionInteractiveService
) => InternalHandler<RequestJsonRpcToEvmMsg> = (
  service,
  permissionInteractionService
) => {
  return async (env, msg) => {
    const defaultChainId =
      await permissionInteractionService.checkEVMPermissionAndGetDefaultChainId(
        env,
        msg.origin
      );

    return await service.request(
      defaultChainId,
      msg.origin,
      msg.method,
      msg.params
    );
  };
};
