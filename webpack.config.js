// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.[contenthash].js',
      publicPath: '/',
      clean: true,
    },
    mode: isProd ? 'production' : 'development',
    devtool: isProd ? 'source-map' : 'eval-source-map',
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react'],
            },
          },
        },
        { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
        { test: /\.(png|jpg|gif|svg)$/i, type: 'asset/resource' },
      ],
    },
    resolve: { extensions: ['.js', '.jsx'] },
    plugins: [
      new HtmlWebpackPlugin({ template: './public/index.html' }),
      new Dotenv({
        path: isProd ? './.env.production' : './.env.development',
        systemvars: false,
      }),
    ],
    devServer: {
      port: 3001,
      historyApiFallback: true,
      hot: true,
      open: false,
      proxy: {
        '/api': {
          target: 'https://frye-market-backend.onrender.com',
          changeOrigin: true,
          secure: true,
          headers: { origin: 'https://frye-market-backend.onrender.com' },
        },
      },
    },
  };
};
