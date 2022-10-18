import * as React from "react";
import styled, { css } from "@xstyled/styled-components";
import { ChevronRightIcon } from "@heroicons/react/24/solid";

const InnerChip = styled.box(({ $color = "primary", $clickable }) => {
  const onColor = `chip-${$color}-on`;
  const bgColor = `chip-${$color}-bg`;
  const bgHoverColor = `chip-${$color}-bg-hover`;

  return css`
    display: inline-flex;
    align-items: center;
    gap: 2;
    background-color: ${bgColor};
    color: ${onColor};
    border-radius: chip;
    width: fit-content;
    padding: 2 4;
    font-size: sm;
    font-weight: 500;
    text-decoration: none;
    cursor: default;

    > [data-chip-icon] {
      width: 1em;
      height: 1em;
    }

    ${$clickable &&
    css`
      transition: default;
      will-change: background-color;

      > [data-chip-arrow] {
        opacity: 0.5;
        transition: default;
        will-change: transform opacity;
      }

      &:hover {
        background-color: ${bgHoverColor};

        > [data-chip-arrow] {
          transform: translateX(4px) scale(1.1);
          opacity: 1;
        }
      }
    `}
  `;
});

export const Chip = React.forwardRef(
  ({ children, clickable, icon: Icon, color = "primary", ...props }, ref) => {
    return (
      <InnerChip ref={ref} $clickable={clickable} $color={color} {...props}>
        {Icon && <Icon data-chip-icon="true" />}
        {children}
        {clickable ? (
          <ChevronRightIcon data-chip-icon="" data-chip-arrow="" />
        ) : null}
      </InnerChip>
    );
  }
);
