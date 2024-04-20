import { Button } from "test-design-system-react";
import { css } from "../styled-system/css";
import "./globals.css";

export default function Home() {
  return (
    <>
      <div
        className={css({
          fontSize: "2xl",
          fontWeight: "bold",
          color: "red.300",
        })}
      >
        Hello 🐼!
      </div>
      <Button>Hello 🐼!</Button>
    </>
  );
}
