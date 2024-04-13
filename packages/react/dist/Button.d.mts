import React, { ReactNode } from 'react';

type ButtonProps = {
    children: ReactNode;
};
declare function Button({ children }: ButtonProps): React.JSX.Element;

export { type ButtonProps, Button as default };
