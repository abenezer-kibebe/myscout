export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center">

      <h1 className="text-5xl font-bold">
        MyScout
      </h1>

      <p className="mt-4 text-gray-500">
        AI Football Transfer Suitability Platform
      </p>

      <button
        className="
        mt-8
        rounded-lg
        bg-black
        px-6
        py-3
        text-white
        "
      >
        Analyze Transfer
      </button>

    </main>
  );
}