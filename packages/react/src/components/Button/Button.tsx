"use client";

import React from "react";
import { css } from "../../../styled-system/css";
import { testUtil } from "../../utils/testUtil";

export default function Button() {
  const handleClick = () => {
    testUtil();
  };

  return (
    <button className={css({ bg: "red.400" })} onClick={handleClick}>
      버튼
    </button>
  );
}
