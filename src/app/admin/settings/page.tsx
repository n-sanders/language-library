import { ActionForm, Field } from "@/components/admin/ActionForm";
import { listModels, type ModelInfo } from "@/lib/ai/openrouter";
import { requireAdmin } from "@/lib/auth";
import { getApiKeyHint, getModels } from "@/lib/settings";
import { removeApiKey, resetPassword, runConnectionTest, saveApiKey, saveModels } from "../actions";

function priceLabel(m: ModelInfo) {
  if (m.promptPrice === null) return m.name;
  if (m.promptPrice === 0) return `${m.name} (free)`;
  return `${m.name} ($${(m.promptPrice * 1_000_000).toFixed(2)}/M input tokens)`;
}

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const hint = getApiKeyHint();
  const models = getModels();

  let available: ModelInfo[] = [];
  let modelsError: string | null = null;
  try {
    available = await listModels();
  } catch (err) {
    modelsError = err instanceof Error ? err.message : "Couldn't load models.";
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold">AI settings</h1>

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-bold">OpenRouter API key</h2>
        <p className="mb-4 text-sm text-stone-600">
          {hint ? (
            <>
              A key is saved (ending in <code>{hint}</code>). It is stored encrypted and never shown again. Paste a new
              one to replace it.
            </>
          ) : (
            <>
              No key saved yet. Create one at{" "}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" className="underline">
                openrouter.ai/keys
              </a>
              .
            </>
          )}
        </p>
        <ActionForm action={saveApiKey} submitLabel="Save key">
          <Field label="API key">
            <input
              name="apiKey"
              type="password"
              autoComplete="off"
              placeholder={hint ? `Saved key ${hint}` : "sk-or-..."}
              className="input"
            />
          </Field>
        </ActionForm>
        {hint && (
          <div className="mt-4 border-t border-stone-100 pt-4">
            <ActionForm action={removeApiKey} submitLabel="Remove saved key" buttonClassName="btn-danger" pendingLabel="Removing..." />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-bold">Models</h2>
        <p className="mb-4 text-sm text-stone-600">
          Start typing to search OpenRouter&apos;s model list. The sentence writer needs a model that follows
          instructions carefully; the helper can be a cheaper, faster one. The audit reviewer reads student history
          when you ask it to on the AI audit page.
          {modelsError && <span className="block text-red-700">Model list unavailable: {modelsError}</span>}
        </p>
        <ActionForm action={saveModels} submitLabel="Save models">
          <Field label="Sentence writer" hint="Writes practice sentences and their answer keys.">
            <input name="sentenceModel" list="model-list" defaultValue={models.sentence} required className="input" />
          </Field>
          <Field label="Helper chat" hint="Answers student questions in the practice helper panel.">
            <input name="helperModel" list="model-list" defaultValue={models.helper} required className="input" />
          </Field>
          <Field label="Audit reviewer" hint="Reads a slice of student helper messages and custom topics when you ask it to on the AI audit page.">
            <input name="auditModel" list="model-list" defaultValue={models.audit} required className="input" />
          </Field>
          <datalist id="model-list">
            {available.map((m) => (
              <option key={m.id} value={m.id}>
                {priceLabel(m)}
              </option>
            ))}
          </datalist>
        </ActionForm>
        <div className="mt-4 border-t border-stone-100 pt-4">
          <p className="mb-2 text-sm text-stone-600">Checks the saved key and sends a tiny request to each saved model.</p>
          <ActionForm
            action={runConnectionTest}
            submitLabel="Test connection"
            pendingLabel="Testing..."
            buttonClassName="btn-secondary"
          />
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">Your admin password</h2>
        <ActionForm action={resetPassword.bind(null, admin.id)} submitLabel="Change password">
          <Field label="New password">
            <input name="password" type="password" required autoComplete="new-password" className="input" />
          </Field>
        </ActionForm>
      </section>
    </div>
  );
}
