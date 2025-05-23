// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.


using FluentAssertions.Execution;
using FluentAssertions.Primitives;
using Newtonsoft.Json.Linq;

namespace TestHelpers;
public class JTokenAssertions : ReferenceTypeAssertions<JToken?, JTokenAssertions>
{
    public JTokenAssertions(JToken? instance, AssertionChain assertionChain)
        : base(instance, assertionChain)
    {
    }

    protected override string Identifier => "jtoken";
}
