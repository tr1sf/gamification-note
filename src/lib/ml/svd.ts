interface SVDOptions {
  factors: number;
  epochs: number;
  lr: number;
  reg: number;
}

export class SVD {
  private userFactors: Map<string, number[]>;
  private quizFactors: Map<string, number[]>;
  private userBias: Map<string, number>;
  private quizBias: Map<string, number>;
  private globalMean: number;
  private options: SVDOptions;

  constructor(options: Partial<SVDOptions> = {}) {
    this.options = { factors: 8, epochs: 40, lr: 0.01, reg: 0.02, ...options };
    this.userFactors = new Map();
    this.quizFactors = new Map();
    this.userBias = new Map();
    this.quizBias = new Map();
    this.globalMean = 0;
  }

  train(ratings: Array<{ userId: string; quizId: string; score: number }>): void {
    if (ratings.length === 0) return;
    this.globalMean = ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
    const userIds = new Set(ratings.map(r => r.userId));
    const quizIds = new Set(ratings.map(r => r.quizId));
    for (const uid of userIds) {
      this.userFactors.set(uid, Array.from({ length: this.options.factors }, () => (Math.random() - 0.5) * 0.1));
      this.userBias.set(uid, 0);
    }
    for (const qid of quizIds) {
      this.quizFactors.set(qid, Array.from({ length: this.options.factors }, () => (Math.random() - 0.5) * 0.1));
      this.quizBias.set(qid, 0);
    }
    const shuffled = [...ratings].sort(() => Math.random() - 0.5);
    for (let epoch = 0; epoch < this.options.epochs; epoch++) {
      for (const r of shuffled) {
        const pred = this.predictRaw(r.userId, r.quizId);
        const error = r.score - pred;
        const uf = this.userFactors.get(r.userId)!;
        const qf = this.quizFactors.get(r.quizId)!;
        let ub = this.userBias.get(r.userId)!;
        let qb = this.quizBias.get(r.quizId)!;
        ub += this.options.lr * (error - this.options.reg * ub);
        qb += this.options.lr * (error - this.options.reg * qb);
        this.userBias.set(r.userId, ub);
        this.quizBias.set(r.quizId, qb);
        for (let k = 0; k < this.options.factors; k++) {
          const ufk = uf[k], qfk = qf[k];
          uf[k] += this.options.lr * (error * qfk - this.options.reg * ufk);
          qf[k] += this.options.lr * (error * ufk - this.options.reg * qfk);
        }
      }
    }
  }

  predict(userId: string, quizId: string): number {
    return Math.max(0, Math.min(100, Math.round(this.predictRaw(userId, quizId))));
  }

  private predictRaw(userId: string, quizId: string): number {
    const uf = this.userFactors.get(userId);
    const qf = this.quizFactors.get(quizId);
    const ub = this.userBias.get(userId) || 0;
    const qb = this.quizBias.get(quizId) || 0;
    if (!uf || !qf) return this.globalMean + ub + qb;
    let dot = 0;
    for (let k = 0; k < this.options.factors; k++) dot += uf[k] * qf[k];
    return this.globalMean + ub + qb + dot;
  }
}
