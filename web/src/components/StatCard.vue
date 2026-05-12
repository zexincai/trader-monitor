<template>
  <el-card class="stat-card-comp" :class="{ 'stat-card-comp--sm': size === 'sm' }">
    <div class="stat-card-comp__inner">
      <div
        class="stat-card-comp__value"
        :class="{
          'value-positive': trend === 'up',
          'value-negative': trend === 'down',
        }"
      >
        {{ value }}
      </div>
      <div class="stat-card-comp__label">{{ label }}</div>
    </div>
  </el-card>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  trend: { type: String, default: 'neutral' },
  size: { type: String, default: 'default' },
});
</script>

<style scoped>
.stat-card-comp__inner {
  text-align: center;
  padding: 8px 0;
}

.stat-card-comp__value {
  font-family: var(--font-heading);
  font-size: 28px;
  font-weight: 700;
  color: var(--color-on-surface);
  line-height: 1.2;
}

.stat-card-comp--sm .stat-card-comp__value {
  font-size: 24px;
}

.stat-card-comp__label {
  font-family: var(--font-body);
  font-size: var(--text-label-sm-size);
  font-weight: var(--text-label-sm-weight);
  letter-spacing: var(--text-label-sm-spacing);
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
  margin-top: 6px;
}

@media (max-width: 767px) {
  .stat-card-comp__value {
    font-size: 22px;
  }
}
</style>
