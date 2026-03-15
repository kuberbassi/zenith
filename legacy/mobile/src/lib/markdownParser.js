/**
 * Markdown Channel Log Formatter
 * Converts GitHub markdown logs to beautifully formatted in-app view
 * Supports: headers, lists, code blocks, tables, links, emphasis, etc.
 */

import React from 'react';
import { View, Text, ScrollView, Linking } from 'react-native';
import { themeService } from './themeService';

/**
 * Parse markdown text and convert to React components
 */
export class MarkdownParser {
  constructor(theme) {
    this.theme = theme;
  }

  /**
   * Main parser entry point
   */
  parse(markdown) {
    const lines = markdown.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Headers
      if (trimmed.startsWith('###')) {
        elements.push({
          type: 'h3',
          content: trimmed.replace(/^#+\s*/, ''),
          id: `h3-${i}`,
        });
        i++;
      } else if (trimmed.startsWith('##')) {
        elements.push({
          type: 'h2',
          content: trimmed.replace(/^#+\s*/, ''),
          id: `h2-${i}`,
        });
        i++;
      } else if (trimmed.startsWith('#')) {
        elements.push({
          type: 'h1',
          content: trimmed.replace(/^#+\s*/, ''),
          id: `h1-${i}`,
        });
        i++;
      }
      // Code blocks
      else if (trimmed.startsWith('```')) {
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push({
          type: 'code',
          content: codeLines.join('\n'),
          language: trimmed.substring(3),
          id: `code-${i}`,
        });
        i++;
      }
      // Tables
      else if (trimmed.includes('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().includes('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        const table = this.parseTable(tableLines);
        if (table) {
          elements.push({
            type: 'table',
            data: table,
            id: `table-${i}`,
          });
        }
      }
      // Lists
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const listItems = [];
        while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
          listItems.push(lines[i].trim().substring(2));
          i++;
        }
        elements.push({
          type: 'list',
          items: listItems,
          id: `list-${i}`,
        });
      }
      // Blockquotes
      else if (trimmed.startsWith('>')) {
        const quoteLines = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().substring(1).trim());
          i++;
        }
        elements.push({
          type: 'blockquote',
          content: quoteLines.join('\n'),
          id: `quote-${i}`,
        });
      }
      // Regular paragraphs
      else if (trimmed.length > 0) {
        const paragraphLines = [];
        while (i < lines.length && lines[i].trim().length > 0 &&
               !lines[i].trim().startsWith('#') &&
               !lines[i].trim().startsWith('- ') &&
               !lines[i].trim().startsWith('* ') &&
               !lines[i].trim().startsWith('>')) {
          paragraphLines.push(lines[i]);
          i++;
        }
        elements.push({
          type: 'paragraph',
          content: paragraphLines.join('\n'),
          id: `para-${i}`,
        });
      } else {
        i++;
      }
    }

    return elements;
  }

  /**
   * Parse table markdown
   */
  parseTable(tableLines) {
    if (tableLines.length < 2) return null;

    const headers = tableLines[0]
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    const rows = tableLines
      .slice(2)
      .map((line) =>
        line
          .split('|')
          .map((cell) => cell.trim())
          .filter((cell) => cell.length > 0)
      );

    return { headers, rows };
  }

  /**
   * Parse inline formatting (bold, italic, code)
   */
  parseInline(text) {
    const parts = [];
    let lastIndex = 0;

    // Bold text
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index),
        });
      }
      parts.push({
        type: 'bold',
        content: match[1],
      });
      lastIndex = boldRegex.lastIndex;
    }

    // Italic text
    const italicRegex = /\*(.*?)\*/g;
    while ((match = italicRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index),
        });
      }
      parts.push({
        type: 'italic',
        content: match[1],
      });
      lastIndex = italicRegex.lastIndex;
    }

    // Inline code
    const codeRegex = /`(.*?)`/g;
    while ((match = codeRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index),
        });
      }
      parts.push({
        type: 'inlineCode',
        content: match[1],
      });
      lastIndex = codeRegex.lastIndex;
    }

    // Links
    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index),
        });
      }
      parts.push({
        type: 'link',
        text: match[1],
        url: match[2],
      });
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
  }
}

/**
 * Markdown Renderer Component
 */
export const MarkdownRenderer = ({ markdown, theme = themeService.getTheme() }) => {
  const parser = new MarkdownParser(theme);
  const elements = parser.parse(markdown);

  const renderElement = (element) => {
    switch (element.type) {
      case 'h1':
        return (
          <Text
            key={element.id}
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: theme.text,
              marginVertical: 16,
              marginTop: 24,
            }}
          >
            {element.content}
          </Text>
        );
      case 'h2':
        return (
          <Text
            key={element.id}
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: theme.primary,
              marginVertical: 12,
              marginTop: 20,
            }}
          >
            {element.content}
          </Text>
        );
      case 'h3':
        return (
          <Text
            key={element.id}
            style={{
              fontSize: 20,
              fontWeight: '600',
              color: theme.secondary,
              marginVertical: 10,
              marginTop: 16,
            }}
          >
            {element.content}
          </Text>
        );
      case 'paragraph':
        return (
          <Text
            key={element.id}
            style={{
              fontSize: 16,
              color: theme.textSecondary,
              lineHeight: 24,
              marginVertical: 8,
            }}
          >
            {element.content}
          </Text>
        );
      case 'list':
        return (
          <View key={element.id} style={{ marginVertical: 8 }}>
            {element.items.map((item, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  marginVertical: 4,
                  paddingLeft: 8,
                }}
              >
                <Text style={{ color: theme.primary, marginRight: 8 }}>•</Text>
                <Text
                  style={{
                    flex: 1,
                    color: theme.textSecondary,
                    fontSize: 14,
                  }}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>
        );
      case 'code':
        return (
          <View
            key={element.id}
            style={{
              backgroundColor: theme.surfaceVariant,
              borderRadius: 8,
              padding: 12,
              marginVertical: 12,
              borderLeftColor: theme.primary,
              borderLeftWidth: 4,
            }}
          >
            <Text
              style={{
                fontFamily: 'monospace',
                color: theme.text,
                fontSize: 12,
              }}
            >
              {element.content}
            </Text>
          </View>
        );
      case 'blockquote':
        return (
          <View
            key={element.id}
            style={{
              backgroundColor: theme.surfaceVariant,
              borderLeftColor: theme.primary,
              borderLeftWidth: 4,
              paddingVertical: 12,
              paddingHorizontal: 16,
              marginVertical: 12,
              borderRadius: 4,
            }}
          >
            <Text
              style={{
                color: theme.textSecondary,
                fontSize: 14,
                fontStyle: 'italic',
              }}
            >
              {element.content}
            </Text>
          </View>
        );
      case 'table':
        return (
          <View
            key={element.id}
            style={{
              borderRadius: 8,
              overflow: 'hidden',
              marginVertical: 12,
            }}
          >
            {/* Header row */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: theme.primary,
              }}
            >
              {element.data.headers.map((header, index) => (
                <Text
                  key={index}
                  style={{
                    flex: 1,
                    color: '#FFFFFF',
                    fontWeight: '600',
                    padding: 12,
                    fontSize: 12,
                  }}
                >
                  {header}
                </Text>
              ))}
            </View>
            {/* Data rows */}
            {element.data.rows.map((row, rowIndex) => (
              <View
                key={rowIndex}
                style={{
                  flexDirection: 'row',
                  backgroundColor: rowIndex % 2 === 0 ? theme.surface : theme.surfaceVariant,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                }}
              >
                {row.map((cell, cellIndex) => (
                  <Text
                    key={cellIndex}
                    style={{
                      flex: 1,
                      color: theme.textSecondary,
                      padding: 12,
                      fontSize: 12,
                    }}
                  >
                    {cell}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background, padding: 16 }}>
      {elements.map((element) => renderElement(element))}
    </ScrollView>
  );
};

export default {
  MarkdownParser,
  MarkdownRenderer,
};
