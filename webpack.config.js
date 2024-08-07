const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
	entry: './src/index.tsx',
	output: {
		path: `${__dirname}/dist`,
		filename: 'bundle.js',
	},
	devtool: 'eval',
	mode: process.env.NODE_ENV || 'development',
	devServer: {
		static: {
			directory: path.join(__dirname, 'dist'),
		},
		hot: true,
		historyApiFallback: true,
		port: 3000,
		open: false,
		compress: true,
		client: {
			overlay: true,
		},
	},
	optimization:
		process.env.NODE_ENV === 'production'
			? {
					minimize: true,
					minimizer: [
						new TerserPlugin({
							extractComments: false,
						}),
					],
					usedExports: true,
			  }
			: {},
	ignoreWarnings: [
		{
			message:
				/Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
		},
		{
			message: /There are multiple modules with names that only differ in casing./,
		},
	],
	module: {
		rules: [
			{
				test: /\.md$/,
				use: 'raw-loader',
			},
			{
				test: /\.(ts|tsx)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							'@babel/preset-env',
							['@babel/preset-react', { runtime: 'automatic' }],
							'@babel/preset-typescript',
						],
					},
				},
			},
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader'],
			},
			{
				test: /\.m?js/,
				resolve: {
					fullySpecified: false,
				},
			},
			{
				test: /\.(png|jpg|gif|riv)$/,
				use: [
					'url-loader',
					{
						loader: 'image-webpack-loader',
						options: {
							mozjpeg: {
								progressive: true,
								quality: 65,
							},
							optipng: {
								enabled: false,
							},
							pngquant: {
								quality: [0.65, 0.9],
								speed: 4,
							},
							gifsicle: {
								interlaced: false,
							},
							webp: {
								quality: 75,
							},
						},
					},
				],
			},
			{
				test: /\.svg$/,
				use: [
					{
						loader: '@svgr/webpack',
						options: {
							icon: true,
						},
					},
					'url-loader',
				],
			},
		],
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: path.join(__dirname, 'public', 'index.html'),
		}),
		new CopyWebpackPlugin({
			patterns: [
				{ from: 'public/favicon.svg', to: 'favicon.svg' },
				{ from: 'public/manifest.json', to: 'manifest.json' },
			],
		}),
		new CleanWebpackPlugin(),
		new webpack.ProvidePlugin({
			process: 'process/browser',
			Buffer: ['buffer', 'Buffer'],
			'window.setImmediate': [require.resolve('timers'), 'setImmediate'],
			'global.setImmediate': [require.resolve('timers'), 'setImmediate'],
		}),
		new webpack.NoEmitOnErrorsPlugin(),
		new webpack.DefinePlugin({
			'process.env.MODULE': JSON.stringify(
				process.env.NODE_ENV === 'production'
					? 'yTyqRSfbD6BuiDra9jDNjq8TLe7rhneDcmQ64CkmkdU'
					: 'yTyqRSfbD6BuiDra9jDNjq8TLe7rhneDcmQ64CkmkdU'
			),
			'process.env.SCHEDULER': JSON.stringify(
				process.env.NODE_ENV === 'production'
					? '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA'
					: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA'
			),
			'process.env.DEFAULT_TOKEN': JSON.stringify(
				process.env.NODE_ENV === 'production'
					? 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10'
					: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10'
			),
			'process.env.UCM': JSON.stringify(
				process.env.NODE_ENV === 'production'
					? 'U3TjJAZWJjlWBB4KAXSHKzuky81jtyh0zqH8rUL4Wd0'
					: 'qtDwylCwyhhsGPKIYAi2Ao342mdhvFUPqdbDOudzaiM'
			),
			'process.env.UCM_ACTIVITY': JSON.stringify(
				process.env.NODE_ENV === 'production'
					? 'SNDvAf2RF-jhPmRrGUcs_b1nKlzU6vamN9zl0e9Zi4c'
					: 'GC9M776w8UEZVkvAGcLqhrH10uumkbQUYrnIo1AiWHo'
			),
			'process.env.PIXL': JSON.stringify(
				process.env.NODE_ENV === 'production'
					? 'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo'
					: 'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo'
			),
			'process.env.PROFILE_REGISTRY': JSON.stringify(
				process.env.NODE_ENV === 'production'
					? 'SNy4m-DrqxWl01YqGM4sxI8qCni-58re8uuJLvZPypY'
					: 'iySPL7MpiZCvei0DIFzjNOudjbCnHHXf9rPgbXH-T90'
			),
			'process.env.PROFILE_SRC': JSON.stringify(
				process.env.NODE_ENV === 'production'
					? '_R2XYWDPUXVvQrQKFaQRvDTDcDwnQNbqlTd_qvCRSpQ'
					: '9Tpz5_ZT4RRkF-6JUTdaaTMg0ARfkNuuM5zahXyCqZ4'
			),
			'process.env.COLLECTIONS_REGISTRY': JSON.stringify(
				process.env.NODE_ENV === 'production'
					? 'TFWDmf8a3_nw43GCm_CuYlYoylHAjCcFGbgHfDaGcsg'
					: 'jii0UeIWYIr4etclyywNGhZVAOwwzmrK56elffh6dzA'
			),
		}),
	],
	resolve: {
		extensions: ['.tsx', '.ts', '.jsx', '.js'],
		preferRelative: true,
		alias: {
			process: 'process/browser',
			crypto: 'crypto-browserify',
			stream: 'stream-browserify',
		},
		fallback: {
			fs: false,
			tls: false,
			net: false,
			path: false,
			zlib: require.resolve('browserify-zlib'),
			http: require.resolve('stream-http'),
			https: require.resolve('https-browserify'),
			events: require.resolve('events/'),
			process: require.resolve('process/browser'),
			crypto: require.resolve('crypto-browserify'),
			stream: require.resolve('stream-browserify'),
			constants: require.resolve('constants-browserify'),
			path: require.resolve('path-browserify'),
			os: require.resolve('os-browserify'),
			util: require.resolve('util'),
			assert: require.resolve('assert'),
			url: require.resolve('url'),
			buffer: require.resolve('buffer'),
			timers: require.resolve('timers-browserify'),
		},
		alias: {
			react: path.resolve(__dirname, 'node_modules/react'),
			process: 'process/browser',
			api: path.resolve(__dirname, 'src/api/'),
			app: path.resolve(__dirname, 'src/app/'),
			arweave: path.resolve(__dirname, 'node_modules/arweave'),
			assets: path.resolve(__dirname, 'src/assets/'),
			components: path.resolve(__dirname, 'src/components/'),
			helpers: path.resolve(__dirname, 'src/helpers/'),
			hooks: path.resolve(__dirname, 'src/hooks/'),
			navigation: path.resolve(__dirname, 'src/navigation/'),
			providers: path.resolve(__dirname, 'src/providers/'),
			root: path.resolve(__dirname, 'src/root/'),
			routes: path.resolve(__dirname, 'src/routes/'),
			store: path.resolve(__dirname, 'src/store/'),
			views: path.resolve(__dirname, 'src/views/'),
			wallet: path.resolve(__dirname, 'src/wallet/'),
			wrappers: path.resolve(__dirname, 'src/wrappers/'),
			'asn1.js': path.resolve(__dirname, 'node_modules/asn1.js'),
			elliptic: path.resolve(__dirname, 'node_modules/elliptic'),
		},
	},
	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'dist'),
	},
};
