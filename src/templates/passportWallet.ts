import { bifoldParams, generateBifold } from './bifoldSleeve';
import { PASSPORT, Template } from './types';

export const passportWallet: Template = {
  id: 'passport-wallet',
  name: 'Passport wallet',
  category: 'Wallets',
  description: 'Bifold passport cover: the passport’s covers slide into two sleeves, with card slots on the left.',
  params: bifoldParams({
    itemW: PASSPORT.w,
    itemH: PASSPORT.h,
    itemT: PASSPORT.t,
    thicknessOz: 3,
    leftFlap: 100,
    rightFlap: 60,
    cardSlots: 2,
    itemLabel: 'Passport',
  }),
  generate: (v) => generateBifold(v, 'Passport wallet', 'Passport'),
};
