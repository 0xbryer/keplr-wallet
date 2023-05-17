import React, { FunctionComponent, useLayoutEffect, useState } from "react";
import { SpecialButtonProps } from "./types";
import { Styles } from "./styles";
import { LoadingIcon } from "../icon";
import { Box } from "../box";
import { ColorPalette } from "../../styles";
import { to, useSpringValue } from "@react-spring/web";

const springConfig = {
  mass: 0.6,
  tension: 270,
  friction: 21,
};

const gradientSpringConfig = {
  mass: 0.6,
  tension: 220,
  friction: 15,
};

const onClickSpringConfig = {
  mass: 0.6,
  tension: 320,
  friction: 10,
};

const gradient1Pos = "16.15%";
const gradient1DefaultColor = ColorPalette["blue-400"];
const gradient1HoverColor = "#2C4BE2";

const gradient2Pos = "100%";
const gradient2DefaultColor = ColorPalette["blue-400"];
const gradient2HoverColor = "#7A59FF";

const defaultBoxShadowColor = "#2723F700";
const hoverBoxShadowColor = "#2723F7FF";
const pressedBoxShadowColor = "#2723F700";

const defaultBoxShadowStrength = 0;
const hoverBoxShadowStrength = 11;
const pressedBoxShadowStrength = 0;

const defaultScale = 1;
const hoverScale = 1.03;
const pressedScale = 0.98;

export const SpecialButton: FunctionComponent<SpecialButtonProps> = ({
  onClick,
  left,
  text,
  right,
  isLoading,
  textOverrideIcon,
}) => {
  const gradient1 = useSpringValue(gradient1DefaultColor);
  const gradient2 = useSpringValue(gradient2DefaultColor);

  const boxShadowColor = useSpringValue(defaultBoxShadowColor);

  const boxShadowStrength = useSpringValue(defaultBoxShadowStrength);

  const scale = useSpringValue(defaultScale);

  const [isHover, setIsHover] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  useLayoutEffect(() => {
    if (isHover) {
      gradient1.start(gradient1HoverColor, {
        config: gradientSpringConfig,
      });
      gradient2.start(gradient2HoverColor, {
        config: gradientSpringConfig,
      });

      scale.start(hoverScale, {
        config: springConfig,
      });
      boxShadowColor.start(hoverBoxShadowColor, {
        config: springConfig,
      });
      boxShadowStrength.start(hoverBoxShadowStrength, {
        config: springConfig,
      });
    } else {
      gradient1.start(gradient1DefaultColor, {
        config: gradientSpringConfig,
      });
      gradient2.start(gradient2DefaultColor, {
        config: gradientSpringConfig,
      });

      scale.start(defaultScale, {
        config: springConfig,
      });
      boxShadowColor.start(defaultBoxShadowColor, {
        config: springConfig,
      });
      boxShadowStrength.start(defaultBoxShadowStrength, {
        config: springConfig,
      });
    }
  }, [boxShadowColor, boxShadowStrength, gradient1, gradient2, isHover, scale]);

  useLayoutEffect(() => {
    if (isPressed) {
      gradient1.start(gradient1HoverColor, {
        config: gradientSpringConfig,
      });
      gradient2.start(gradient2HoverColor, {
        config: gradientSpringConfig,
      });

      scale.start(pressedScale, {
        config: springConfig,
      });
      boxShadowColor.start(pressedBoxShadowColor, {
        config: springConfig,
      });
      boxShadowStrength.start(pressedBoxShadowStrength, {
        config: springConfig,
      });
    }
  }, [
    boxShadowColor,
    boxShadowStrength,
    gradient1,
    gradient2,
    isPressed,
    scale,
  ]);

  return (
    <Styles.Container>
      <Styles.Button
        isLoading={isLoading}
        type="button"
        onClick={() => {
          setIsPressed(false);

          gradient1.start(gradient1DefaultColor, {
            config: gradientSpringConfig,
          });
          gradient2.start(gradient2DefaultColor, {
            config: gradientSpringConfig,
          });

          scale.start(defaultScale, {
            config: onClickSpringConfig,
          });
          boxShadowColor.start(defaultBoxShadowColor, {
            config: onClickSpringConfig,
          });
          boxShadowStrength.start(defaultBoxShadowStrength, {
            config: onClickSpringConfig,
          });

          if (onClick) {
            onClick();
          }
        }}
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => {
          setIsHover(false);
          // 외부에서 마우스가 up 되었을 경우 event가 발생하지 않으므로 여기서도 처리해준다.
          setIsPressed(false);
        }}
        onMouseDown={() => setIsPressed(true)}
        style={{
          background: to(
            [gradient1, gradient2],
            (g1, g2) =>
              `linear-gradient(90deg, ${g1} ${gradient1Pos}, ${g2} ${gradient2Pos})`
          ),
          transform: to(scale, (s) => `scale(${s})`),
          boxShadow: to(
            [boxShadowColor, boxShadowStrength],
            (c, s) => `0px 0px ${s}px ${c}`
          ),
        }}
      >
        {left ? <Styles.Left>{left}</Styles.Left> : null}

        {isLoading ? (
          <Styles.Loading>
            <LoadingIcon width="1rem" height="1rem" />
          </Styles.Loading>
        ) : null}

        {!isLoading && textOverrideIcon ? (
          <Styles.TextOverrideIcon>{textOverrideIcon}</Styles.TextOverrideIcon>
        ) : null}

        <Box style={{ opacity: isLoading || textOverrideIcon ? 0 : 1 }}>
          {text}
        </Box>

        {right ? <Styles.Right>{right}</Styles.Right> : null}
      </Styles.Button>
    </Styles.Container>
  );
};
