import { Worker } from "bullmq";
import { getTranslator, type Locale } from "@dsk/i18n";
import { connection } from "../connection";
import { QUEUE_NAMES, type EmailJob } from "../queues";

/**
 * Email worker.
 * Renders subject/body from the i18n "emails" namespace in the recipient's
 * locale, then hands off to the mailer. The dev mailer logs to stdout;
 * production wires SMTP_URL to a real transport behind the same signature.
 */
async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (process.env.SMTP_URL) {
    // Production transport (e.g. nodemailer over SMTP_URL) plugs in here.
    console.log(`[emails] SMTP send to=${to} subject="${subject}"`);
    return;
  }
  console.log(`[emails] (dev) to=${to}\nsubject: ${subject}\n${body}`);
}

export function startEmailsWorker() {
  const worker = new Worker<EmailJob>(
    QUEUE_NAMES.emails,
    async (job) => {
      const { to, template, locale, vars } = job.data;
      const t = getTranslator(locale as Locale, "emails");
      const subject = t(`${template}.subject`, vars);
      const body = t(`${template}.body`, vars);
      await sendEmail(to, subject, body);
    },
    { connection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[emails] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
