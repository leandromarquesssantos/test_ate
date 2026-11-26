---
name: atelier-spec-brainstorm
description: >-
  Use this skill when starting Substantial Work (a new feature, architecture change,
  or multi-surface capability) to produce a durable specification document (spec.md)
  before any technical planning or code implementation.
---

# Atelier — Fase 1: Spec Brainstorm

## Objetivo
Transformar uma ideia ou pedido em uma especificação clara, verificável e versionada em `docs/specs/REQ-XXX-<slug>/spec.md`, sem pular para código.

## Passos
1. Identifique o próximo número `REQ-XXX` disponível em `docs/specs/`.
2. Leia o template em [spec.template.md](./resources/spec.template.md).
3. Defina com clareza:
   - **Problema e Objetivo** (*por quê* e *para quem*).
   - **Escopo (In-Scope)** e **Não-Escopo (Out-of-Scope)** explícitos para evitar *scope creep*.
   - **Requisitos Funcionais** numerados (`RF-01`, `RF-02`...) com critérios de aceite testáveis (estilo Given/When/Then).
   - **Requisitos Não-Funcionais e Restrições** (precisão monetária, segurança, offline/mobile, performance).
   - **Decisões em Aberto** que precisam de validação do Principal Engineer.
4. Salve em `docs/specs/REQ-XXX-<slug>/spec.md`.

## Validação
- Todos os requisitos possuem critérios de aceite objetivos e verificáveis por testes.
- Existe seção explícita de **Fora de Escopo**.
- Nenhum código de produção foi alterado nesta fase.
