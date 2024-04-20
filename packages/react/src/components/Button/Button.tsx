"use client";

import React, { ReactNode } from "react";
import { css } from "../../../styled-system/css";
import "../../../main.css";

export type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
};

export default function Button({ children, onClick }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={css({
        bg: "red.300",
        px: "4",
        py: "3",
        borderRadius: "md",
        _hover: { bg: "red.500" },
      })}
    >
      {children}
    </button>
  );
}
