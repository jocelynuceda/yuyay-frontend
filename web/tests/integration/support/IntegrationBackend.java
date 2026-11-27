package qa;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.yuyay.YuyayApplication;
import com.yuyay.care.repository.ClaimInvitationRepository;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import com.yuyay.notification.email.EmailSender;
import org.springframework.boot.SpringApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/** Arranque exclusivo del runner local. No se copia ni compila dentro del backend publicado. */
@Configuration(proxyBeanMethods = false)
public class IntegrationBackend {
    private static final AtomicReference<Instant> NOW = new AtomicReference<>(Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS));
    private static final Map<String, List<String>> MAIL = new ConcurrentHashMap<>();

    @Bean @Primary
    Clock integrationClock() {
        return new Clock() {
            public ZoneId getZone() { return ZoneOffset.UTC; }
            public Clock withZone(ZoneId zone) { return Clock.fixed(NOW.get(), zone); }
            public Instant instant() { return NOW.get(); }
        };
    }

    @Bean @Primary
    EmailSender integrationMail() {
        return (to, subject, html) -> MAIL.computeIfAbsent(to.toLowerCase(),
                ignored -> new CopyOnWriteArrayList<>()).add(html);
    }

    public static void main(String[] ignored) throws Exception {
        String key = System.getenv("YUYAY_QA_CONTROL_KEY");
        String storage = System.getenv("YUYAY_QA_STORAGE_DIR");
        if (key == null || key.length() < 32 || storage == null || storage.isBlank()) {
            throw new IllegalStateException("Este arranque requiere el runner de integración local");
        }
        var context = SpringApplication.run(new Class<?>[]{YuyayApplication.class, IntegrationBackend.class},
                new String[]{
                    "--spring.profiles.active=test", "--server.address=127.0.0.1", "--server.port=18068",
                    "--spring.datasource.url=jdbc:h2:mem:yuyay_qa;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                    "--spring.datasource.username=sa", "--spring.datasource.password=",
                    "--spring.datasource.driver-class-name=org.h2.Driver",
                    "--spring.jpa.hibernate.ddl-auto=create-drop",
                    "--app.storage.type=local", "--app.storage.local-dir=" + storage,
                    "--app.mail.resend-api-key=", "--spring.mail.username=", "--app.reniec.api-token=",
                    "--app.reminders.enabled=false", "--app.admin.password=", "--app.demo.password=",
                    "--app.frontend-url=http://localhost:5173"
                });
        // El proveedor sintético viene únicamente de target/test-classes y del perfil test.
        var identity = context.getBean(com.yuyay.identity.IdentityDirectory.class);
        if (!identity.isConfigured() || !identity.getClass().getName().equals("com.yuyay.identity.FixtureIdentityDirectory")) {
            context.close();
            throw new IllegalStateException("La integración requiere el directorio sintético de pruebas");
        }
        ObjectMapper json = new ObjectMapper();
        HttpServer control = HttpServer.create(new InetSocketAddress("127.0.0.1", 18069), 0);
        control.createContext("/", exchange -> {
            try {
                String supplied = exchange.getRequestHeaders().getFirst("X-QA-Control");
                if (supplied == null || !MessageDigest.isEqual(key.getBytes(StandardCharsets.UTF_8),
                        supplied.getBytes(StandardCharsets.UTF_8))) {
                    respond(exchange, json, 403, Map.of("error", "Control no autorizado"));
                    return;
                }
                String path = exchange.getRequestURI().getPath();
                if ("/status".equals(path) && "GET".equals(exchange.getRequestMethod())) {
                    respond(exchange, json, 200, Map.of("ready", true));
                } else if ("/clock".equals(path) && "POST".equals(exchange.getRequestMethod())) {
                    long seconds = json.readTree(exchange.getRequestBody().readAllBytes()).path("advanceSeconds").asLong(-1);
                    if (seconds < 0 || seconds > 604800) {
                        respond(exchange, json, 400, Map.of("error", "Avance inválido"));
                        return;
                    }
                    respond(exchange, json, 200, Map.of("now", NOW.updateAndGet(time -> time.plusSeconds(seconds)).toString()));
                } else if ("/expire-claim".equals(path) && "POST".equals(exchange.getRequestMethod())) {
                    long id = json.readTree(exchange.getRequestBody().readAllBytes()).path("invitationId").asLong();
                    new TransactionTemplate(context.getBean(PlatformTransactionManager.class)).executeWithoutResult(status -> {
                        var repository = context.getBean(ClaimInvitationRepository.class);
                        var invitation = repository.findById(id).orElseThrow();
                        invitation.setValidUntil(Instant.now().minusSeconds(1));
                        repository.save(invitation);
                    });
                    respond(exchange, json, 200, Map.of("expired", true));
                } else if ("/outbox".equals(path) && "POST".equals(exchange.getRequestMethod())) {
                    String email = json.readTree(exchange.getRequestBody().readAllBytes()).path("email").asString("").toLowerCase();
                    respond(exchange, json, 200, MAIL.getOrDefault(email, List.of()));
                } else {
                    respond(exchange, json, 404, Map.of("error", "Control inexistente"));
                }
            } catch (Exception failure) {
                respond(exchange, json, 500, Map.of("error", "Falló el control de pruebas"));
            } finally {
                exchange.close();
            }
        });
        control.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        control.start();
    }

    private static void respond(HttpExchange exchange, ObjectMapper json, int status, Object body) throws java.io.IOException {
        byte[] bytes = json.writeValueAsBytes(body);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }
}
