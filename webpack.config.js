// webpack.config.js
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  // Read envs once and bake them into the bundle
  const API_BASE_URL = process.env.API_BASE_URL || '';
  const WS_URL = process.env.WS_URL || '';

  return {
    mode: isProd ? 'production' : 'development',

    entry: './src/main.jsx', // if your entry is different, change here

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? 'bundle.[contenthash].js' : 'bundle.js',
      publicPath: '/', // keeps client‑side routing happy
      clean: true,
    },

    resolve: {
      extensions: ['.js', '.jsx'],
    },

    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                '@babel/preset-react',
              ],
            },
          },
        },
      ],
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'public/index.html'), // or 'src/index.html' if that’s your template
        filename: 'index.html',
      }),

      // 🔑 Bake env values into the bundle so `process.env.*` works in the browser
      new webpack.DefinePlugin({
        'process.env.API_BASE_URL': JSON.stringify(API_BASE_URL),
        'process.env.WS_URL': JSON.stringify(WS_URL),
        'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
      }),
    ],

    devtool: isProd ? 'source-map' : 'eval-source-map',

    // Local dev convenience: calls to /api/* get proxied to your backend
    devServer: {
      port: 3000,
      historyApiFallback: true,
      static: { directory: path.resolve(__dirname, 'public') },
      proxy: API_BASE_URL
        ? {
            '/api': {
              target: API_BASE_URL,
              changeOrigin: true,
              secure: false,
              logLevel: 'silent',
            },
          }
        : undefined,
    },
  };
};
