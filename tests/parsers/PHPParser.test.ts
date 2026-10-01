import { describe, it, expect } from 'vitest';
import { PHPParser } from '../../src/parsers/PHPParser';

describe('PHPParser', () => {
  const parser = new PHPParser();

  it('parses Blade view includes and components', () => {
    const code = `@extends('layouts.app')
@include('partials.header', ['title' => $title])
<x-alert type="success" :message="$message" />
@component('layouts.alert', ['type' => 'warning'])
`;

    const result = parser.parseBladeTemplate(code, 'resources/views/home.blade.php');

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'layout', name: 'layouts.app' }),
      expect.objectContaining({ type: 'include', name: 'partials.header' }),
      expect.objectContaining({ type: 'component', name: 'alert' }),
      expect.objectContaining({ type: 'component', name: 'layouts.alert' })
    ]));
  });
});
