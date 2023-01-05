import React, { FunctionComponent } from "react";
import { XAxisProps } from "./types";
import styled from "styled-components";

const Styles = {
  XAxis: styled.div<XAxisProps>`
    display: flex;
    flex-direction: row;
    align-items: ${({ alignY }) => {
      switch (alignY) {
        case "bottom":
          return "flex-end";
        case "center":
          return "center";
        default:
          return "flex-start";
      }
    }};
  `,
};

export const XAxis: FunctionComponent<XAxisProps> = ({
  children,
  ...props
}) => {
  return <Styles.XAxis {...props}>{children}</Styles.XAxis>;
};
