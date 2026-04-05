import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('api_usage')
@Index(['createdAt'])
@Index(['model'])
export class ApiUsage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  model!: string;

  @Column({ name: 'input_tokens', type: 'integer', default: 0 })
  inputTokens!: number;

  @Column({ name: 'output_tokens', type: 'integer', default: 0 })
  outputTokens!: number;

  @Column({ name: 'cost_usd', type: 'decimal', precision: 10, scale: 6, default: 0 })
  costUsd!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId?: string;

  @Column({ type: 'boolean', default: true })
  success!: boolean;

  @Column({ name: 'duration_ms', type: 'integer', nullable: true })
  durationMs?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
