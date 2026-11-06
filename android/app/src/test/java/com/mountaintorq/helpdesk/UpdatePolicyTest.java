package com.mountaintorq.helpdesk;
import org.junit.Test;
import static org.junit.Assert.*;
public class UpdatePolicyTest {
  @Test public void versionsNeverDowngradeOrAcceptPaths(){assertTrue(UpdatePolicy.newer("1.0.10","1.0.9"));assertFalse(UpdatePolicy.newer("1.0.9","1.0.10"));assertFalse(UpdatePolicy.newer("1.0.9","1.0.9"));assertFalse(UpdatePolicy.newer("../1.0.11","1.0.9"));}
  @Test public void downloadsOnlyUseTrustedHttps(){assertTrue(UpdatePolicy.allowed("https://release-assets.githubusercontent.com/a"));assertFalse(UpdatePolicy.allowed("http://github.com/a"));assertFalse(UpdatePolicy.allowed("https://github.com.evil.example/a"));assertFalse(UpdatePolicy.allowed("https://github.com@evil.example/a"));assertFalse(UpdatePolicy.allowed("https://github.com:8080/a"));}
  @Test public void checksumMustMatchTheExactApk()throws Exception{String hash="a".repeat(64);assertEquals(hash,UpdatePolicy.checksum(hash+"  Mountain-Torq-Helpdesk-1.0.10.apk\n",UpdatePolicy.filename("1.0.10")));try{UpdatePolicy.checksum(hash+"  other.apk","expected.apk");fail();}catch(Exception expected){}}
}
