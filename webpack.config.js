const htmlPlugin = require('html-webpack-plugin');
const copyWebpackPlugin = require('copy-webpack-plugin');
var webpack = require('webpack');
var path = require('path');
var vendor = require('./vendor');

module.exports = {
  context: __dirname,
  entry: {
    'main': './main.js',
    'pdf.worker': './node_modules/pdfjs-dist/build/pdf.worker.entry',
    'vendor': [...vendor]
  },
  output: {
    path: path.join(__dirname, 'dist/'),
    publicPath: './',
    filename: '[name].js'
  },

  resolve: {
    extensions: ['.js'],
    alias: {
      '$': 'jQuery'
    }
  },

  plugins: [
    new htmlPlugin({
        title: 'Embeddable Player',
        filename: 'index.html',
        template: 'index.html'
    }),
    new webpack.optimize.UglifyJsPlugin({
      compressor: {
        screw_ie8: true,
        warnings: false
      }
    }),
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery'
    }),
    new copyWebpackPlugin([
      {from: 'lib'}
    ]),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor'
    })
  ]
};