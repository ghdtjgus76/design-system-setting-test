import React, { ReactNode } from "react";
import "../../../main.css";
export type ButtonProps = {
    children: ReactNode;
    onClick?: () => void;
};
export default function Button({ children, onClick }: ButtonProps): React.JSX.Element;
