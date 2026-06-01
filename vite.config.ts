import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";
import viteCompression from "vite-plugin-compression";
import path from "path";
import { Config } from "../shared/shared_config";
// https://vitejs.dev/config/

export default defineConfig(({mode})=>{
	Config.initialize(process.env.NODE_ENV as "PRODUCTION" | "DEVELOPMENT");
	
	return {
		define: {
			"__SERVER_URI__": JSON.stringify(Config.getServer.GET_URI),
			"__PROTOCOL__": JSON.stringify(Config.getServer.PROTOCOL)
		},
		plugins: [
			preact(),
			VitePWA({
				strategies: "injectManifest",
				srcDir: "src",
				filename: "sw.ts",
				registerType: "prompt",
				includeManifestIcons: false,
				manifest: {
					name: "M.A.G.U.S.",
					short_name: "MAGUS",
					description: "MAGUS roleplaying game companion app",
					theme_color: "#000000",
					background_color: "#000000",
					display: "standalone",
					scope: "/",
					start_url: "/",
					icons: [
						{
							src: "/icons/pwa-192x192.png",
							sizes: "192x192",
							type: "image/png",
						},
						{
							src: "/icons/pwa-512x512.png",
							sizes: "512x512",
							type: "image/png",
						},
						{
							src: "/icons/maskable-512x512.png",
							sizes: "512x512",
							type: "image/png",
							purpose: "maskable",
						},
					],
				},
				workbox: {
					cleanupOutdatedCaches: true,
					globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
					navigateFallback: "/index.html",
				},
				injectManifest: {
					globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
				},
			}),
			viteCompression({
				algorithm: "gzip",
				ext: ".gz",
				deleteOriginFile: false,
			}),
		],
		server: {
			fs: {
				allow: ["../shared", "./src", "./node_modules", "./dist", "./public", "./index.html"],
			},
			host: Config.getClient.URI,
			port: Config.getClient.PORT,
			open: Config.getClient.URI !== "http://localhost" ? true : false,
		},
		preview: {
			port: Config.getClient.PREVIEW_PORT
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
				"@app": path.resolve(__dirname, "./src/app"),
				"@components": path.resolve(__dirname, "./src/components"),
				"@contexts": path.resolve(__dirname, "./src/contexts"),
				"@core": path.resolve(__dirname, "./src/core"),
				"@hooks": path.resolve(__dirname, "./src/hooks"),
				"@pages": path.resolve(__dirname, "./src/pages"),
				"@utils": path.resolve(__dirname, "./src/utils"),
				"@shared": path.resolve(__dirname, "../shared"),
				react: "preact/compat",
				"react-dom": "preact/compat",
				"react/jsx-runtime": "preact/jsx-runtime",
				//	e:/synced/own/web/magus/client/src/components/icons/magus/CharSpeIcon
				//  "@css": path.resolve(__dirname, "./src/assets/css"),
				//  "@components": path.resolve(__dirname, "./src/components"),
				//  "@images": path.resolve(__dirname, "./src/assets/imgs"),
				//  "@constants": path.resolve(__dirname, "./src/assets/constants"),
				//  "@config": path.resolve(__dirname, "./src/assets/config"),
			},
		},
		build: {
			cssMinify: true,
			outDir: "./dist",
			emptyOutDir: true,
			sourcemap: false,
		},
		css: {
			devSourcemap: false,
		},
	}
});
