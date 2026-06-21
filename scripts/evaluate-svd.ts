/**
 * SVD Model Evaluation Script
 *
 * Runs offline evaluation of the SVD Matrix Factorization model on synthetic
 * + real quiz attempt data. Outputs RMSE, MAE, coverage, cold-start rate,
 * baseline comparison, and A/B test group metrics.
 *
 * Usage:
 *   npx tsx scripts/evaluate-svd.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { SVD } from "../src/lib/ml/svd";

interface Attempt {
  userId: string;
  quizId: string;
  score: number;
}

function rmse(predictions: number[], actuals: number[]): number {
  if (predictions.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    sum += (predictions[i] - actuals[i]) ** 2;
  }
  return Math.sqrt(sum / predictions.length);
}

function mae(predictions: number[], actuals: number[]): number {
  if (predictions.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    sum += Math.abs(predictions[i] - actuals[i]);
  }
  return sum / predictions.length;
}

/** FNV-1a hash for deterministic A/B group assignment. */
function experimentGroup(userId: string): "control" | "personalized" {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 2 === 0 ? "control" : "personalized";
}

function bar(count: number, total: number, width = 20): string {
  const filled = Math.round((count / total) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  SVD Model Evaluation Report");
  console.log("  TavernoteX — Quiz Difficulty Prediction");
  console.log("═══════════════════════════════════════════\n");

  // 1. Load all quiz attempts
  const attempts = await prisma.quizAttempt.findMany({
    select: { userId: true, quizId: true, score: true, completedAt: true },
    orderBy: { completedAt: "asc" },
  }) as Attempt[];

  if (attempts.length < 10) {
    console.log("❌ Not enough data (< 10 attempts). Run generate-quiz-data.ts first.");
    await prisma.$disconnect();
    return;
  }

  const userIds = new Set(attempts.map(a => a.userId));
  const quizIds = new Set(attempts.map(a => a.quizId));

  console.log("Dataset:");
  console.log(`  Total attempts:     ${attempts.length}`);
  console.log(`  Unique users:      ${userIds.size}`);
  console.log(`  Unique quizzes:    ${quizIds.size}`);

  // 2. 80/20 stratified train/test split (by user — each user contributes
  //    ~80% train, ~20% test to ensure the model has seen each user).
  const byUser = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (!byUser.has(a.userId)) byUser.set(a.userId, []);
    byUser.get(a.userId)!.push(a);
  }

  const trainSet: Attempt[] = [];
  const testSet: Attempt[] = [];

  for (const [uid, userAttempts] of byUser) {
    // Sort by date to ensure temporal split (train on earlier, test on later)
    userAttempts.sort((a, b) => (a as any).completedAt.getTime() - (b as any).completedAt.getTime());
    const splitIdx = Math.ceil(userAttempts.length * 0.8);
    trainSet.push(...userAttempts.slice(0, splitIdx));
    testSet.push(...userAttempts.slice(splitIdx));
  }

  // If test set is too small (users with only 1 attempt), fallback to random 80/20
  if (testSet.length < 5) {
    const shuffled = [...attempts].sort(() => Math.random() - 0.5);
    const splitIdx = Math.ceil(shuffled.length * 0.8);
    trainSet.length = 0;
    testSet.length = 0;
    trainSet.push(...shuffled.slice(0, splitIdx));
    testSet.push(...shuffled.slice(splitIdx));
  }

  console.log(`  Train set:          ${trainSet.length} (${Math.round(trainSet.length / attempts.length * 100)}%)`);
  console.log(`  Test set:           ${testSet.length} (${Math.round(testSet.length / attempts.length * 100)}%)`);

  // 3. Train SVD model on train set
  console.log("\nModel Configuration:");
  console.log("  Algorithm:          SVD Matrix Factorization");
  console.log("  Latent factors:     8");
  console.log("  Epochs:             40");
  console.log("  Learning rate:      0.01");
  console.log("  Regularization:     0.02");

  const trainStart = Date.now();
  const model = new SVD({ factors: 8, epochs: 40, lr: 0.01, reg: 0.02 });
  model.train(trainSet);
  const trainTime = Date.now() - trainStart;

  console.log(`  Training time:      ${trainTime}ms`);

  // 4. Global mean (baseline predictor)
  const globalMean = trainSet.reduce((s, a) => s + a.score, 0) / trainSet.length;

  // 5. Evaluate on test set
  const svdPredictions: number[] = [];
  const baselinePredictions: number[] = [];
  const actuals: number[] = [];
  let coldStartCount = 0;

  for (const a of testSet) {
    const pred = model.predict(a.userId, a.quizId);
    svdPredictions.push(pred);
    baselinePredictions.push(globalMean);
    actuals.push(a.score);

    // Check if this was a cold-start (model had no factors for user or quiz)
    const hasUser = (model as any).userFactors?.has(a.userId);
    const hasQuiz = (model as any).quizFactors?.has(a.quizId);
    if (!hasUser || !hasQuiz) coldStartCount++;
  }

  const svdRMSE = rmse(svdPredictions, actuals);
  const baselineRMSE = rmse(baselinePredictions, actuals);
  const improvement = baselineRMSE > 0
    ? ((baselineRMSE - svdRMSE) / baselineRMSE * 100)
    : 0;

  const svdMAE = mae(svdPredictions, actuals);
  const baselineMAE = mae(baselinePredictions, actuals);

  const coverage = testSet.length > 0
    ? ((testSet.length - coldStartCount) / testSet.length * 100)
    : 0;
  const coldStartRate = testSet.length > 0
    ? (coldStartCount / testSet.length * 100)
    : 0;

  console.log("\n───────────────────────────────────────────");
  console.log("Performance Metrics (Test Set):");
  console.log("───────────────────────────────────────────");
  console.log(`  SVD RMSE:           ${svdRMSE.toFixed(2)}`);
  console.log(`  Baseline RMSE:      ${baselineRMSE.toFixed(2)}  (global mean predictor)`);
  console.log(`  Improvement:        ${improvement.toFixed(1)}%  ← SVD beats baseline by ${improvement.toFixed(1)}%`);
  console.log();
  console.log(`  SVD MAE:            ${svdMAE.toFixed(2)}`);
  console.log(`  Baseline MAE:       ${baselineMAE.toFixed(2)}`);

  console.log("\n───────────────────────────────────────────");
  console.log("Coverage:");
  console.log("───────────────────────────────────────────");
  console.log(`  Personalized predictions:  ${testSet.length - coldStartCount} / ${testSet.length} (${coverage.toFixed(1)}%)`);
  console.log(`  Cold-start fallback:       ${coldStartCount} / ${testSet.length} (${coldStartRate.toFixed(1)}%)`);

  // 6. Prediction distribution
  const buckets = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100
  for (const p of svdPredictions) {
    const idx = Math.min(4, Math.floor(p / 20));
    buckets[idx]++;
  }

  console.log("\n───────────────────────────────────────────");
  console.log("Prediction Distribution:");
  console.log("───────────────────────────────────────────");
  const labels = ["  [  0-20]", "  [ 20-40]", "  [ 40-60]", "  [ 60-80]", "  [ 80-100]"];
  for (let i = 0; i < 5; i++) {
    const pct = (buckets[i] / svdPredictions.length * 100).toFixed(1);
    console.log(`${labels[i]}  ${bar(buckets[i], svdPredictions.length)}  ${buckets[i]} (${pct}%)`);
  }

  // 7. A/B test group analysis (using FNV-1a hash — same as production)
  let controlUsers = 0, personalizedUsers = 0;
  let controlTotal = 0, controlCount = 0;
  let personalizedTotal = 0, personalizedCount = 0;
  const userImprovements = new Map<string, { group: string; improvement: number }>();

  for (const [uid, ua] of byUser) {
    const group = experimentGroup(uid);
    if (group === "control") controlUsers++;
    else personalizedUsers++;

    const avgScore = ua.reduce((s, a) => s + a.score, 0) / ua.length;
    if (group === "control") { controlTotal += avgScore; controlCount++; }
    else { personalizedTotal += avgScore; personalizedCount++; }

    // Calculate accuracy improvement (last attempt - first attempt per quiz)
    const quizScores = new Map<string, number[]>();
    for (const a of ua) {
      if (!quizScores.has(a.quizId)) quizScores.set(a.quizId, []);
      quizScores.get(a.quizId)!.push(a.score);
    }
    let impSum = 0, impCount = 0;
    for (const [, scores] of quizScores) {
      if (scores.length >= 2) {
        impSum += scores[scores.length - 1] - scores[0];
        impCount++;
      }
    }
    const imp = impCount > 0 ? impSum / impCount : 0;
    userImprovements.set(uid, { group, improvement: imp });
  }

  const controlAvg = controlCount > 0 ? controlTotal / controlCount : 0;
  const personalizedAvg = personalizedCount > 0 ? personalizedTotal / personalizedCount : 0;

  const controlImpVals = Array.from(userImprovements.values()).filter(v => v.group === "control").map(v => v.improvement);
  const personalizedImpVals = Array.from(userImprovements.values()).filter(v => v.group === "personalized").map(v => v.improvement);
  const controlImpAvg = controlImpVals.length > 0 ? controlImpVals.reduce((s, v) => s + v, 0) / controlImpVals.length : 0;
  const personalizedImpAvg = personalizedImpVals.length > 0 ? personalizedImpVals.reduce((s, v) => s + v, 0) / personalizedImpVals.length : 0;

  console.log("\n───────────────────────────────────────────");
  console.log("A/B Test Group Analysis (FNV-1a hash split):");
  console.log("───────────────────────────────────────────");
  console.log(`  Control group:        ${controlUsers} users`);
  console.log(`  Personalized group:   ${personalizedUsers} users`);
  console.log();
  console.log(`  Control — Avg Score:           ${controlAvg.toFixed(1)}%`);
  console.log(`  Personalized — Avg Score:      ${personalizedAvg.toFixed(1)}%`);
  console.log(`  Delta:                         ${(personalizedAvg - controlAvg).toFixed(1)}%`);
  console.log();
  console.log(`  Control — Accuracy Improvement:     ${controlImpAvg >= 0 ? "+" : ""}${controlImpAvg.toFixed(1)}%`);
  console.log(`  Personalized — Improvement:          ${personalizedImpAvg >= 0 ? "+" : ""}${personalizedImpAvg.toFixed(1)}%`);
  console.log(`  Delta:                               ${(personalizedImpAvg - controlImpAvg).toFixed(1)}%`);

  console.log("\n═══════════════════════════════════════════");
  if (improvement > 0) {
    console.log(`  Conclusion: SVD model outperforms baseline`);
    console.log(`  by ${improvement.toFixed(1)}% RMSE reduction. Personalized group`);
    console.log(`  shows ${(personalizedImpAvg - controlImpAvg).toFixed(1)}% more accuracy improvement vs control.`);
  } else {
    console.log(`  Conclusion: SVD model does NOT outperform baseline.`);
    console.log(`  Consider increasing factors or training data.`);
  }
  console.log("═══════════════════════════════════════════\n");

  // Save results as JSON for easy import into thesis
  const results = {
    timestamp: new Date().toISOString(),
    dataset: {
      totalAttempts: attempts.length,
      uniqueUsers: userIds.size,
      uniqueQuizzes: quizIds.size,
      trainSet: trainSet.length,
      testSet: testSet.length,
    },
    model: {
      algorithm: "SVD Matrix Factorization",
      factors: 8,
      epochs: 40,
      learningRate: 0.01,
      regularization: 0.02,
      trainingTimeMs: trainTime,
    },
    performance: {
      svdRMSE: parseFloat(svdRMSE.toFixed(2)),
      baselineRMSE: parseFloat(baselineRMSE.toFixed(2)),
      improvementPct: parseFloat(improvement.toFixed(1)),
      svdMAE: parseFloat(svdMAE.toFixed(2)),
      baselineMAE: parseFloat(baselineMAE.toFixed(2)),
    },
    coverage: {
      personalized: testSet.length - coldStartCount,
      coldStart: coldStartCount,
      coveragePct: parseFloat(coverage.toFixed(1)),
      coldStartPct: parseFloat(coldStartRate.toFixed(1)),
    },
    predictionDistribution: buckets,
    abTest: {
      controlUsers,
      personalizedUsers,
      controlAvgScore: parseFloat(controlAvg.toFixed(1)),
      personalizedAvgScore: parseFloat(personalizedAvg.toFixed(1)),
      controlImprovement: parseFloat(controlImpAvg.toFixed(1)),
      personalizedImprovement: parseFloat(personalizedImpAvg.toFixed(1)),
      improvementDelta: parseFloat((personalizedImpAvg - controlImpAvg).toFixed(1)),
    },
  };

  console.log("📋 JSON results (copy for thesis):");
  console.log(JSON.stringify(results, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
