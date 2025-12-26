// Quick spectral verification - expected values for test graphs

const testGraphs = {
    'Cycle C_3': { n: 3, spectralRadius: 2, alpha: 0, rationality: 1 },
    'Cycle C_6': { n: 6, spectralRadius: 2, alpha: 0, rationality: 1 },
    'Cycle C_10': { n: 10, spectralRadius: 2, alpha: 0, rationality: 1 },
    'Path P_4': { n: 4, spectralRadius: 2*Math.cos(Math.PI/5), alpha: 0 },
    'Path P_8': { n: 8, spectralRadius: 2*Math.cos(Math.PI/9), alpha: 0 },
    'Star S_4': { n: 4, spectralRadius: Math.sqrt(3), alpha: 0.5, rationality: 1 },
    'Star S_6': { n: 6, spectralRadius: Math.sqrt(5), alpha: 0.5, rationality: 1 },
    'Star S_10': { n: 10, spectralRadius: Math.sqrt(9), alpha: 0.5, rationality: 1 },
    'Complete K_4': { n: 4, spectralRadius: 3, alpha: 1, rationality: 1 },
    'Complete K_6': { n: 6, spectralRadius: 5, alpha: 1, rationality: 1 },
    'Complete K_8': { n: 8, spectralRadius: 7, alpha: 1, rationality: 1 },
    'Hypercube Q_2': { n: 4, spectralRadius: 2, alpha: 1 },
    'Hypercube Q_3': { n: 8, spectralRadius: 3, alpha: 1 },
    'Hypercube Q_4': { n: 16, spectralRadius: 4, alpha: 1 },
    'Hypercube Q_5': { n: 32, spectralRadius: 5, alpha: 1 },
    'Wheel W_5': { n: 5, spectralRadius: 1 + Math.sqrt(4), alpha: 0.5 },
    'Wheel W_8': { n: 8, spectralRadius: 1 + Math.sqrt(7), alpha: 0.5 },
    'Petersen': { n: 10, spectralRadius: 3, alpha: 0, rationality: 1 }
};

console.log('EXPECTED SPECTRAL RADIUS VALUES');
console.log('=' .repeat(60));

// Group by family and sort by spectral radius
const families = {};
for (const [name, data] of Object.entries(testGraphs)) {
    const family = name.split(' ')[0].replace(/_.*/, '');
    if (!families[family]) families[family] = [];
    families[family].push({ name, ...data });
}

for (const [family, graphs] of Object.entries(families)) {
    console.log(`\n${family}:`);
    graphs.sort((a, b) => a.spectralRadius - b.spectralRadius);
    for (const g of graphs) {
        console.log(`  ${g.name.padEnd(16)} ρ = ${g.spectralRadius.toFixed(4).padStart(7)} | α = ${g.alpha} | n = ${g.n}`);
    }
}

console.log('\n\nSPECTRAL RADIUS ORDERING (all graphs, by ρ):');
console.log('-'.repeat(60));
const allGraphs = Object.entries(testGraphs).map(([name, data]) => ({ name, ...data }));
allGraphs.sort((a, b) => a.spectralRadius - b.spectralRadius);
for (const g of allGraphs) {
    console.log(`ρ = ${g.spectralRadius.toFixed(4).padStart(7)} | ${g.name.padEnd(16)} | α = ${g.alpha}`);
}

console.log('\n\nKEY POSITIONING CHECKS:');
console.log('-'.repeat(60));
console.log('- All Cycles should have SAME ρ = 2.0000 (α=0, bounded)');
console.log('- Hypercube Q_d should have ρ = d (α=1, linear growth)');
console.log('- Complete K_n should have ρ = n-1 (α=1, linear growth)');
console.log('- Star S_n should have ρ = √(n-1) (α=0.5, square root growth)');
console.log('- Hypercube Q_3 (ρ=3) should be HIGHER than Cycle (ρ=2) on Z-axis');
