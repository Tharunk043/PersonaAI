import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Instagram,
  Twitter,
  Youtube,
  Facebook,
  FileInput,
  Search,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { searchGoogle } from "../services/googleSearch";
import {
  generateSearchBasedPrompt,
  generateDefaultPrompt,
} from "../utils/promptGenerator";

const platforms = [
  { name: "Twitter", icon: Twitter },
  { name: "Instagram", icon: Instagram },
  { name: "YouTube", icon: Youtube },
  { name: "Facebook", icon: Facebook },
];

const cardVariant = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28 } },
};

const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [personaName, setPersonaName] = useState("");
  const [demographics, setDemographics] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any>(null);

  const disabledSubmit = !personaName.trim() || isLoading || searching;

  const handleSearch = async () => {
    if (!personaName.trim()) {
      setError("Please enter a persona name");
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const results = await searchGoogle(personaName.trim());
      setSearchResults(results);
    } catch (err) {
      setError("Failed to fetch search results. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log("[UserProfile] Generating prompt for:", personaName.trim());
      let personaPrompt = "";
      if (searchResults && searchResults?.organic_results?.length) {
        personaPrompt = generateSearchBasedPrompt(personaName.trim(), searchResults);
      } else {
        personaPrompt = generateDefaultPrompt(personaName.trim(), demographics.trim());
      }

      console.log("[UserProfile] Navigating to /chat with state prompt length:", personaPrompt.length);
      navigate("/chat", { state: { personaPrompt } });
    } catch (err) {
      setError("Something went wrong while generating the persona.");
    } finally {
      setIsLoading(false);
    }
  };

  const preview = useMemo(() => {
    if (searchResults?.organic_results?.length) {
      return generateSearchBasedPrompt(personaName.trim() || "Unnamed Persona", searchResults)
        ?.slice(0, 600);
    }
    if (personaName || demographics) {
      return generateDefaultPrompt(personaName.trim() || "Unnamed Persona", demographics.trim())
        ?.slice(0, 600);
    }
    return "Your generated persona preview will appear here once you start typing or search.";
  }, [personaName, demographics, searchResults]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto"
      >
        {/* Header */}
        <div className="rounded-3xl overflow-hidden shadow-sm border border-gray-200/60 dark:border-gray-800/80 bg-white dark:bg-gray-900">
          <div className="px-8 py-7 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Build Your AI Persona
            </h2>
            <p className="mt-2 text-indigo-100/90">
              Search an influencer or describe your content focus. We’ll craft the persona.
            </p>
          </div>

          {/* Content Grid */}
          <div className="grid lg:grid-cols-2 gap-8 p-6 sm:p-8">
            {/* Left: Form */}
            <motion.form
              variants={cardVariant}
              initial="hidden"
              animate="show"
              onSubmit={handleSubmit}
              className="space-y-6"
              aria-label="Persona form"
            >
              {/* Persona Name + Search */}
              <div>
                <label
                  htmlFor="personaName"
                  className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2"
                >
                  Persona Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="personaName"
                    value={personaName}
                    onChange={(e) => setPersonaName(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., Marques Brownlee, Ali Abdaal, your brand..."
                    aria-invalid={!!error && !personaName.trim()}
                    aria-describedby="personaName-help"
                  />
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={searching || !personaName.trim()}
                    className="px-4 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Search Google for persona"
                  >
                    {searching ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p id="personaName-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Tip: Searching fetches public info to enrich the persona.
                </p>
              </div>

              {/* Platforms */}
              <div>
                <span className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Select Platform <span className="text-gray-400 font-normal">(optional)</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {platforms.map((platform) => {
                    const Icon = platform.icon;
                    const active = selectedPlatform === platform.name;
                    return (
                      <button
                        key={platform.name}
                        type="button"
                        onClick={() =>
                          setSelectedPlatform(active ? "" : platform.name)
                        }
                        aria-pressed={active}
                        className={[
                          "group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all",
                          active
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                            : "border-gray-200 dark:border-gray-800 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:border-indigo-700/70 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-200",
                        ].join(" ")}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{platform.name}</span>
                      </button>
                    );
                  })}
                </div>
                {!!selectedPlatform && (
                  <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-400">
                    Targeting: <span className="font-medium">{selectedPlatform}</span>
                  </p>
                )}
              </div>

              {/* Content Focus */}
              <div>
                <label
                  htmlFor="demographics"
                  className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2"
                >
                  Content Focus & Expertise
                </label>
                <textarea
                  id="demographics"
                  value={demographics}
                  onChange={(e) => setDemographics(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Describe themes, tone, niche, audience, expertise, posting cadence…"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    Be specific: “tech reviews, short-form tips, calm educator tone”.
                  </span>
                  <span>{demographics.length}/600</span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={disabledSubmit}
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Persona…
                    </>
                  ) : (
                    "Generate Persona & Start Chat"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/manual-input")}
                  className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold py-3 px-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-all"
                >
                  <FileInput className="w-5 h-5" />
                  Manual Input
                </button>
              </div>
            </motion.form>

            {/* Right: Preview & Results */}
            <div className="space-y-6">
              {/* Persona Preview */}
              <motion.div
                variants={cardVariant}
                initial="hidden"
                animate="show"
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Live Persona Preview
                  </h3>
                  <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Read-only
                  </span>
                </div>
                <div className="h-48 overflow-auto rounded-xl bg-white dark:bg-gray-800 p-4 text-sm leading-6 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-800">
                  {preview}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {personaName ? (
                    <span className="px-2 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                      Name: {personaName}
                    </span>
                  ) : null}
                  {selectedPlatform ? (
                    <span className="px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                      Platform: {selectedPlatform}
                    </span>
                  ) : null}
                  {demographics ? (
                    <span className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                      Focus added
                    </span>
                  ) : null}
                </div>
              </motion.div>

              {/* Search Results */}
              <motion.div
                variants={cardVariant}
                initial="hidden"
                animate="show"
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Web Results
                  </h3>
                  {searching && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Fetching…
                    </span>
                  )}
                </div>

                {!searchResults && !searching && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    No results yet. Enter a name and click search.
                  </div>
                )}

                {/* Loading skeleton */}
                {searching && (
                  <div className="space-y-3 animate-pulse">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-full" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-5/6" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Results */}
                {!!searchResults?.organic_results?.length && !searching && (
                  <div className="space-y-3">
                    {searchResults.organic_results.slice(0, 4).map((result: any, idx: number) => (
                      <div
                        key={idx}
                        className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 border border-gray-200 dark:border-gray-800"
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {result.title}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                          {result.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
          Pro tip: You can generate a persona without web results—just describe your content focus.
        </p>
      </motion.div>
    </div>
  );
};

export default UserProfile;
