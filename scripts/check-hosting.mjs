import { createProductionGatewayOptions } from "../server/production.mjs";

try {
	createProductionGatewayOptions(process.env);
	console.log("Hosting configuration is structurally valid. No network requests or deployment performed.");
	console.log("Provider plans, authentication, email delivery, migrations, content approval and hosted behavior still require verification.");
} catch (error) {
	console.error(`Hosting configuration is incomplete: ${error.message}`);
	process.exitCode = 1;
}
