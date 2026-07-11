import base from '@lilochat/tooling/eslint/base.mjs';

export default [...base, { ignores: ['.next/**', 'next-env.d.ts'] }];
