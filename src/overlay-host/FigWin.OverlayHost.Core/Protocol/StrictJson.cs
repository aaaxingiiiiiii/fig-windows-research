// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using System.Text.Json;

namespace FigWin.OverlayHost.Protocol;

public sealed class StrictJsonException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>
/// 严格的 JSON 解析（第 2 节）：重复键、嵌套超过 16 层、字符串中未配对的代理项都视为错误。
/// 与 inshellisense 一侧的 src/overlay/json.ts 规则相同。
/// </summary>
public static class StrictJson
{
    public static JsonDocument Parse(ReadOnlyMemory<byte> utf8)
    {
        Validate(utf8.Span);
        try
        {
            return JsonDocument.Parse(utf8, new JsonDocumentOptions { MaxDepth = ProtocolConstants.MaxDepth });
        }
        catch (JsonException e)
        {
            throw new StrictJsonException("invalid JSON", e);
        }
    }

    private static void Validate(ReadOnlySpan<byte> utf8)
    {
        var reader = new Utf8JsonReader(utf8, new JsonReaderOptions { MaxDepth = ProtocolConstants.MaxDepth });
        var objects = new Stack<HashSet<string>?>();
        try
        {
            while (reader.Read())
            {
                switch (reader.TokenType)
                {
                    case JsonTokenType.StartObject:
                        objects.Push(new HashSet<string>(StringComparer.Ordinal));
                        break;
                    case JsonTokenType.StartArray:
                        objects.Push(null);
                        break;
                    case JsonTokenType.EndObject:
                    case JsonTokenType.EndArray:
                        objects.Pop();
                        break;
                    case JsonTokenType.PropertyName:
                        var name = ReadString(ref reader);
                        if (!objects.Peek()!.Add(name)) throw new StrictJsonException($"duplicate key \"{name}\"");
                        break;
                    case JsonTokenType.String:
                        ReadString(ref reader);
                        break;
                }
            }
        }
        catch (JsonException e)
        {
            throw new StrictJsonException("invalid JSON", e);
        }
    }

    private static string ReadString(ref Utf8JsonReader reader)
    {
        string value;
        try
        {
            value = reader.GetString()!;
        }
        catch (InvalidOperationException e)
        {
            throw new StrictJsonException("invalid string", e);
        }
        if (HasLoneSurrogate(value)) throw new StrictJsonException("lone surrogate in string");
        return value;
    }

    public static bool HasLoneSurrogate(string value)
    {
        for (var i = 0; i < value.Length; i++)
        {
            if (char.IsHighSurrogate(value[i]))
            {
                if (i + 1 < value.Length && char.IsLowSurrogate(value[i + 1]))
                {
                    i++;
                    continue;
                }
                return true;
            }
            if (char.IsLowSurrogate(value[i])) return true;
        }
        return false;
    }
}
