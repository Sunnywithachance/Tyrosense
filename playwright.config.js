import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5173',
    viewport: {width:390,height:844},
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),
      args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'],
    },
  },
  webServer: {command:'npm start',url:'http://localhost:5173',reuseExistingServer:true},
});
