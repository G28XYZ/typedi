import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const config = {
  input: 'build/esm5/index.js',
  context: 'globalThis',
  output: [
    {
      name: 'ClassTransformer',
      format: 'umd',
      exports: 'named',
      file: 'build/bundles/typedi.umd.js',
      sourcemap: true,
    },
    {
      name: 'ClassTransformer',
      format: 'umd',
      exports: 'named',
      file: 'build/bundles/typedi.umd.min.js',
      sourcemap: true,
      plugins: [terser()],
    },
  ],
  plugins: [commonjs(), nodeResolve()],
};

export default config;
