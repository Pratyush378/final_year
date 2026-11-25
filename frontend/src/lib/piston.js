
const PISTON_API = "/piston-api";

const LANGUAGE_VERSIONS = {
  javascript: { language: "javascript", version: "18.15.0" },
  python: { language: "python", version: "3.10.0" },
  java: { language: "java", version: "15.0.2" },
};

export async function executeCode(language, code, stdin = "") {
  try {
    const config = LANGUAGE_VERSIONS[language];

    if (!config) {
      return {
        success: false,
        error: `Unsupported language: ${language}`,
      };
    }

    const response = await fetch(`${PISTON_API}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: config.language,
        version: config.version,
        files: [
          {
            name: `main.${getFileExtension(language)}`,
            content: code,
          },
        ],
        stdin,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error:
          data.message ||
          `Piston API error: HTTP ${response.status}`,
      };
    }

    const compile = data.compile;
    const run = data.run;

    if (compile && (compile.code !== 0 || compile.status)) {
      return {
        success: false,
        output: compile.stdout || "",
        error:
          compile.stderr ||
          compile.message ||
          "Compilation failed",
      };
    }

    if (!run) {
      return {
        success: false,
        error: "No execution result received from Piston",
      };
    }

    const output = run.stdout || "";
    const error = run.stderr || "";

    if (run.code !== 0 || run.status) {
      return {
        success: false,
        output,
        error: error || run.message || run.status ||
          `Program exited with code ${run.code}`,
      };
    }

    return {
      success: true,
      output,
      error,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to execute code: ${err.message}`,
    };
  }
}

function getFileExtension(language) {
  const extensions = {
    javascript: "js",
    python: "py",
    java: "java",
  };

  return extensions[language] || "txt";
}
