"use client";

import React, { ReactNode } from "react";
import { css } from "../../../styled-system/css/css.mjs";
import { testUtil } from "../../utils/testUtil";
import "../../main.css";

export type ButtonProps = {
  children: ReactNode;
};

export default function Button({ children }: ButtonProps) {
  const handleClick = () => {
    testUtil();
  };

  return (
    <button
      onClick={handleClick}
      className={css({
        bg: "red.300",
        fontFamily: "Inter",
        px: "4",
        py: "3",
        borderRadius: "md",
        _hover: { bg: "red.400" },
      })}
    >
      {children}
    </button>
  );
}
