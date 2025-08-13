// webpack.config.js
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (env, argv) => {
  const isDev = argv.mode !== "production";

  return {
    entry: path.resolve(__dirname, "src/main.jsx"),
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: isDev ? "bundle.js" : "bundle.[contenthash].js",
      clean: true,
      publicPath: "/"
    },
    resolve: {
      extensions: [".js", ".jsx"]
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                ["@babel/preset-env", { targets: "defaults" }],
                ["@babel/preset-react", { runtime: "automatic" }]
              ]
            }
          }
        },
        {
          test: /\.css$/i,
          use: ["style-loader", "css-loader"]
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "index.html"),
        inject: "body"
      })
    ],
    devtool: isDev ? "eval-source-map" : "source-map",
    devServer: {
      static: path.resolve(__dirname, "public"),
      port: 5173,
      hot: true,
      historyApiFallback: true,
      client: { overlay: true }
    }
  };
};
