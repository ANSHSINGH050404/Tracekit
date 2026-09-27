import { DEFAULT_SECRET_PATTERNS } from "./patterns.js";

export interface RedactionOptions {
  /**
   * Names of environment variables or property keys whose values should be redacted,
   * or literal secret strings to redact.
   */
  redact?: string[];
  /**
   * Additional custom regex patterns to match against strings.
   */
  patterns?: RegExp[];
  /**
   * Mask string used to replace secrets. Defaults to "[REDACTED]".
   */
  mask?: string;
  /**
   * Whether to include default secret patterns (OpenAI, Anthropic, GitHub, AWS, etc.).
   * Defaults to true.
   */
  includeDefaults?: boolean;
}

export class Redactor {
  private readonly mask: string;
  private readonly patterns: RegExp[];
  private readonly literalSecrets: Set<string>;
  private readonly sensitiveKeyNames: Set<string>;

  constructor(options: RedactionOptions = {}) {
    this.mask = options.mask ?? "[REDACTED]";
    this.patterns = [];
    this.literalSecrets = new Set<string>();
    this.sensitiveKeyNames = new Set<string>();

    if (options.includeDefaults !== false) {
      this.patterns.push(
        ...DEFAULT_SECRET_PATTERNS.map(
          (p) => new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g")
        )
      );
    }

    if (options.patterns) {
      for (const pattern of options.patterns) {
        this.patterns.push(
          new RegExp(
            pattern.source,
            pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"
          )
        );
      }
    }

    if (options.redact) {
      for (const item of options.redact) {
        if (!item || typeof item !== "string") continue;
        this.sensitiveKeyNames.add(item.toLowerCase());

        // Check if item corresponds to an env variable in Node environment
        if (typeof process !== "undefined" && process.env && process.env[item]) {
          const envVal = process.env[item];
          if (envVal && envVal.length > 3) {
            this.literalSecrets.add(envVal);
          }
        }

        // If the item itself looks like a secret string (e.g. contains special chars or > 6 chars)
        if (item.length > 6 && !/^[A-Z0-9_]+$/.test(item)) {
          this.literalSecrets.add(item);
        }
      }
    }
  }

  /**
   * Redacts any detected secrets from a single string.
   */
  public redactString(str: string): string {
    if (!str || typeof str !== "string") return str;

    let result = str;

    // Redact literal secrets first
    for (const secret of this.literalSecrets) {
      if (result.includes(secret)) {
        result = result.split(secret).join(this.mask);
      }
    }

    // Database URL special handling: preserve scheme, user, and host, redact password
    result = result.replace(
      /((?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis):\/\/[^:]+:)([^@\s]+)(@)/g,
      `$1${this.mask}$3`
    );

    // Apply regex patterns
    for (const pattern of this.patterns) {
      // Reset lastIndex for stateful regexes
      pattern.lastIndex = 0;
      result = result.replace(pattern, (match, ...groups) => {
        // If regex matched DB url, skip if already handled
        if (match.includes("://") && match.includes(this.mask)) {
          return match;
        }
        return this.mask;
      });
    }

    return result;
  }

  /**
   * Recursively redacts sensitive data from any JavaScript value,
   * preserving object shapes and non-sensitive primitives.
   */
  public redactDeep<T>(value: T, seen = new WeakSet<object>()): T {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "string") {
      return this.redactString(value) as unknown as T;
    }

    if (typeof value !== "object") {
      return value;
    }

    // Prevent cycles
    if (seen.has(value)) {
      return value;
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => this.redactDeep(item, seen)) as unknown as T;
    }

    const obj = value as Record<string, unknown>;
    const copy: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitiveKey =
        this.sensitiveKeyNames.has(lowerKey) ||
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("api_key") ||
        lowerKey.includes("apikey");

      if (isSensitiveKey && typeof val === "string") {
        copy[key] = this.mask;
      } else {
        copy[key] = this.redactDeep(val, seen);
      }
    }

    return copy as T;
  }
}
