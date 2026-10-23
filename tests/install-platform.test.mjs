import test from "node:test";
import assert from "node:assert/strict";
import {installPlatform,apkDownload} from "../src/install-platform.ts";
test("Install actions distinguish Android, iPhone, desktop and installed app",()=>{
 assert.equal(installPlatform("Android","Linux",5),"android");
 assert.equal(installPlatform("iPhone","iPhone",5),"ios");
 assert.equal(installPlatform("Mozilla Macintosh","MacIntel",5),"ios");
 assert.equal(installPlatform("Windows NT 10.0","Win32",0),"windows");
 assert.equal(installPlatform("Android MountainTorqAndroid/1.0.1","Linux",5),"installed");
 assert.equal(installPlatform("Macintosh","MacIntel",0),"other");
 assert.equal(apkDownload(null),null);
 assert.equal(apkDownload("https://evil.example"),null);
 assert.match(apkDownload("1.0.1"),/releases\/download\/android-v1\.0\.1\//);
});
