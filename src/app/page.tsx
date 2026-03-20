import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-sky-200">
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center mb-6 mt-4">
            <Image 
              src="/Logo1.png" 
              alt="PT Sachi Logo" 
              width={100} 
              height={100} 
              className="object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300" 
              priority 
            />
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 mt-2">
            Sistem Pelaporan Progres <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-600">PT Sachi</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto">
            Platform pemantauan kerja lapangan terintegrasi. Laporan pekerjaan difasilitasi melalui Telegram Bot dan langsung tersinkronisasi dengan dashboard secara real-time.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/dashboard"
              className="inline-flex justify-center items-center px-8 py-3.5 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-full transition-all duration-200 hover:scale-105 shadow-xl shadow-slate-900/10 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 w-full sm:w-auto"
            >
              Buka Dashboard
              <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            <a
              href="https://t.me/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex justify-center items-center px-8 py-3.5 text-base font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2 w-full sm:w-auto"
            >
              <svg className="mr-2 w-5 h-5 text-sky-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              Kirim Laporan via Bot
            </a>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-slate-500 text-sm border-t border-slate-200/60 bg-white">
        &copy; {new Date().getFullYear()} PT Sachi. All rights reserved.
      </footer>
    </div>
  );
}
