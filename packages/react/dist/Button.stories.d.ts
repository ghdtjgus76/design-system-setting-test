import { StoryObj } from '@storybook/react';
import Button from './Button.js';
import 'react';

declare const meta: {
    title: string;
    component: typeof Button;
    tags: string[];
};

type Story = StoryObj<typeof meta>;
declare const DefaultButton: Story;

export { DefaultButton, meta as default };
