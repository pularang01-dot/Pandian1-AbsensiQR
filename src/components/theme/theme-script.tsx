/** Dijalankan sebelum halaman tampil agar tidak berkedip saat memuat tema tersimpan. */
const SCRIPT = `(function(){try{var m=localStorage.getItem("theme")||"auto";var d=m==="dark"||(m==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}