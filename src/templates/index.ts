import { cardHolder } from './cardHolder';
import { notebookCover } from './notebookCover';
import { passportWallet } from './passportWallet';
import type { Template } from './types';

export const templates: Template[] = [cardHolder, passportWallet, notebookCover];
export const getTemplate = (id: string) => templates.find((t) => t.id === id);
