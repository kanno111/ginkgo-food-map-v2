import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.KeyPairGenerator;
import java.util.Base64;

/** 本地开发工具：从 backend 目录执行 java tools/GenerateJwtKeys.java；绝不覆盖已有密钥。 */
public class GenerateJwtKeys {
    /** 只生成本机 RSA 文件，不打印密钥内容；生产密钥应由部署环境单独管理。 */
    public static void main(String[] args) throws Exception {
        Path directory = Path.of("secrets");
        Path privateFile = directory.resolve("jwt-private.pem");
        Path publicFile = directory.resolve("jwt-public.pem");
        if (Files.exists(privateFile) || Files.exists(publicFile)) {
            throw new IllegalStateException("Key files already exist; refusing to overwrite");
        }
        var generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        var keys = generator.generateKeyPair();
        Files.createDirectories(directory);
        Files.writeString(privateFile, pem("PRIVATE KEY", keys.getPrivate().getEncoded()), StandardOpenOption.CREATE_NEW);
        Files.writeString(publicFile, pem("PUBLIC KEY", keys.getPublic().getEncoded()), StandardOpenOption.CREATE_NEW);
        System.out.println("Created ignored local JWT key files in backend/secrets");
    }

    private static String pem(String type, byte[] bytes) {
        return "-----BEGIN " + type + "-----\n" + Base64.getMimeEncoder(64, new byte[]{'\n'})
                .encodeToString(bytes) + "\n-----END " + type + "-----\n";
    }
}
