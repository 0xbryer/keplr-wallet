import {
  Env,
  Handler,
  InternalHandler,
  KeplrError,
  Message,
} from "@keplr-wallet/router";
import { RequestJsonRpcEthereum } from "./messages";
import { JsonRpcEthereumService } from "./service";
import { PermissionInteractiveService } from "../permission-interactive";

export const getHandler: (
  service: JsonRpcEthereumService,
  permissionInteractionService: PermissionInteractiveService
) => Handler = (
  service: JsonRpcEthereumService,
  permissionInteractionService
) => {
  return (env: Env, msg: Message<unknown>) => {
    switch (msg.constructor) {
      case RequestJsonRpcEthereum:
        return handleRequestMsg(service, permissionInteractionService)(
          env,
          msg as RequestJsonRpcEthereum
        );
      default:
        throw new KeplrError("keyring", 221, "Unknown msg type");
    }
  };
};

const handleRequestMsg: (
  service: JsonRpcEthereumService,
  permissionInteractionService: PermissionInteractiveService
) => InternalHandler<RequestJsonRpcEthereum> = (
  service,
  permissionInteractionService
) => {
  return async (env, msg) => {
    const defaultChainId =
      await permissionInteractionService.checkEVMPermissionAndGetDefaultChainId(
        env,
        msg.origin
      );

    return await service.request(defaultChainId, msg.method, msg.params);
  };
};
