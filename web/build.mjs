import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const isWatch = process.argv.includes("--watch");

// HTML template that embeds the built widget
const htmlTemplate = (jsBundle) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MacroMicro Widget</title>
</head>
<body>
    <div id="root"></div>
    <script type="module">${jsBundle}</script>
</body>
</html>`;

async function build() {
  try {
    // Build the React component
    const result = await esbuild.build({
      entryPoints: ["src/MacroMicroWidget.tsx"],
      bundle: true,
      minify: !isWatch,
      format: "esm",
      target: ["es2020"],
      jsx: "automatic",
      write: false,
      sourcemap: isWatch ? "inline" : false,
    });

    // Get the bundled JS
    const jsBundle = result.outputFiles[0].text;

    // Write the combined HTML file
    const htmlOutput = htmlTemplate(jsBundle);
    fs.writeFileSync(path.join("dist", "widget.html"), htmlOutput);

    console.log("Built widget.html successfully");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

if (isWatch) {
  console.log("Watching for changes...");
  const ctx = await esbuild.context({
    entryPoints: ["src/MacroMicroWidget.tsx"],
    bundle: true,
    minify: false,
    format: "esm",
    target: ["es2020"],
    jsx: "automatic",
    write: false,
    sourcemap: "inline",
    plugins: [
      {
        name: "rebuild-notify",
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length === 0) {
              const jsBundle = result.outputFiles[0].text;
              const htmlOutput = htmlTemplate(jsBundle);
              fs.writeFileSync(path.join("dist", "widget.html"), htmlOutput);
              console.log(`[${new Date().toLocaleTimeString()}] Rebuilt widget.html`);
            }
          });
        },
      },
    ],
  });
  await ctx.watch();
} else {
  await build();
}
